import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;

const cleanDatabaseId = (id: string | undefined): string => {
  if (!id) return "";
  const match = id.replace(/-/g, "").match(/[a-f0-9]{32}/i);
  return match ? match[0] : id;
};

const NOTION_DATABASE_ID = cleanDatabaseId(process.env.NOTION_DATABASE_ID);

if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
} else if (!NOTION_DATABASE_ID) {
  console.error("NOTION_DATABASE_ID 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

interface NotionPostProps {
  title: string;
  category: string;
  tags: string[];
  slug: string;
  summary: string;
  published: boolean;
  publishedAt: string;
  updatedAt: string;
}

function parseNotionProperties(page: PageObjectResponse): NotionPostProps {
  const props = page.properties;

  // Title
  const titleProp = props.Title;
  const title = titleProp?.type === "title" && titleProp.title[0]?.plain_text
    ? titleProp.title[0].plain_text
    : "Untitled";

  // Category (Select)
  const categoryProp = props.Category;
  const category = categoryProp?.type === "select" && categoryProp.select?.name
    ? categoryProp.select.name
    : "Uncategorized";

  // Tag (Multi-select)
  const tagProp = props.Tag;
  const tags = tagProp?.type === "multi_select"
    ? tagProp.multi_select.map((t) => t.name)
    : [];

  // Slug
  const slugProp = props.Slug;
  const slug = slugProp?.type === "rich_text" && slugProp.rich_text[0]?.plain_text
    ? slugProp.rich_text[0].plain_text
    : page.id.replace(/-/g, "");

  // Summary
  const summaryProp = props.Summary;
  const summary = summaryProp?.type === "rich_text" && summaryProp.rich_text[0]?.plain_text
    ? summaryProp.rich_text[0].plain_text
    : "";

  // Published (Checkbox)
  const publishedProp = props.Published;
  const published = publishedProp?.type === "checkbox" ? publishedProp.checkbox : false;

  // PublishedAt (Date)
  const publishedAtProp = props.PublishedAt;
  const publishedAt = publishedAtProp?.type === "date" && publishedAtProp.date?.start
    ? publishedAtProp.date.start
    : page.created_time.split("T")[0];

  // UpdatedAt (Date)
  const updatedAtProp = props.UpdatedAt;
  const updatedAt = updatedAtProp?.type === "date" && updatedAtProp.date?.start
    ? updatedAtProp.date.start
    : page.last_edited_time.split("T")[0];

  return { title, category, tags, slug, summary, published, publishedAt, updatedAt };
}

async function syncNotionToJekyll(): Promise<void> {
  console.log("노션 데이터베이스에서 발행 글 수집 시작...");

  // 노션 데이터베이스 속성명 'Published' 기준 조회
  const response = await notion.request<{ results: Array<PageObjectResponse | Record<string, unknown>> }>({
    path: `databases/${NOTION_DATABASE_ID}/query`,
    method: "post",
    body: {
      filter: {
        property: "Published",
        checkbox: {
          equals: true,
        },
      },
    },
  });

  type QueryResultItem = typeof response.results[number];

  const pages = response.results.filter(
    (result: QueryResultItem): result is PageObjectResponse =>
      "properties" in result
  );

  console.log(`동기화 대상 게시글: 총 ${pages.length}개`);

  const targetDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const page of pages) {
    const meta = parseNotionProperties(page);

    const mdblocks = await n2m.pageToMarkdown(page.id);
    const mdObject = n2m.toMarkdownString(mdblocks);
    const contentBody = mdObject.parent;

    const safeTitle = meta.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeSummary = meta.summary.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    const tagsYaml = meta.tags.length > 0
      ? meta.tags.map((t) => `  - "${t}"`).join("\n")
      : "  []";

    const frontMatter = `---
title: "${safeTitle}"
date: ${meta.publishedAt}
last_modified_at: ${meta.updatedAt}
categories:
  - "${meta.category}"
tags:
${tagsYaml}
excerpt: "${safeSummary}"
toc: true
toc_sticky: true
---

`;

    const fullMarkdownContent = frontMatter + contentBody;

    const fileName = `${meta.publishedAt}-${meta.slug}.md`;
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, fullMarkdownContent, "utf8");
    console.log(`업데이트 완료: ${fileName}`);
  }

  console.log("노션 글 동기화 작업이 성공적으로 완료되었습니다.");
}

syncNotionToJekyll().catch((err: unknown) => {
  console.error("동기화 도중 오류 발생:", err);
  process.exit(1);
});