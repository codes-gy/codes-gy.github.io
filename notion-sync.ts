import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type {
  PageObjectResponse,
  QueryDatabaseResponse
} from "@notionhq/client/build/src/api-endpoints";
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

  const titleProp = props.title;
  const title = titleProp?.type === "title" && titleProp.title[0]?.plain_text
    ? titleProp.title[0].plain_text
    : "Untitled";

  let category = "Uncategorized";
  const categoryProp = props.category;
  if (categoryProp?.type === "select" && categoryProp.select?.name) {
    category = categoryProp.select.name;
  } else if (categoryProp?.type === "multi_select" && categoryProp.multi_select[0]?.name) {
    category = categoryProp.multi_select[0].name;
  }

  const tagProp = props.tag;
  const tags = tagProp?.type === "multi_select"
    ? tagProp.multi_select.map((t) => t.name)
    : [];

  const slugProp = props.slug;
  const slug = slugProp?.type === "rich_text" && slugProp.rich_text[0]?.plain_text
    ? slugProp.rich_text[0].plain_text
    : page.id.replace(/-/g, "");

  const summaryProp = props.summary;
  const summary = summaryProp?.type === "rich_text" && summaryProp.rich_text[0]?.plain_text
    ? summaryProp.rich_text[0].plain_text
    : "";

  const publishedProp = props.published;
  const published = publishedProp?.type === "checkbox" ? publishedProp.checkbox : false;

  const publishedAtProp = props.publishedAt;
  const publishedAt = publishedAtProp?.type === "date" && publishedAtProp.date?.start
    ? publishedAtProp.date.start
    : page.created_time.split("T")[0];

  const updatedAtProp = props.updatedAt;
  const updatedAt = updatedAtProp?.type === "date" && updatedAtProp.date?.start
    ? updatedAtProp.date.start
    : page.last_edited_time.split("T")[0];

  return { title, category, tags, slug, summary, published, publishedAt, updatedAt };
}

async function syncNotionToJekyll(): Promise<void> {
  console.log("노션 데이터베이스에서 발행 글 수집 시작...");

  const response = await notion.request<QueryDatabaseResponse>({
    path: `databases/${NOTION_DATABASE_ID}/query`,
    method: "post", // 대문자 처리
    body: {
      filter: {
        property: "published",
        checkbox: {
          equals: true,
        },
      },
    },
  });

  const pages = response.results.filter(
    (result: QueryDatabaseResponse["results"][number]): result is PageObjectResponse =>
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

    // 안전한 문자열 이스케이프
    const safeTitle = meta.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const safeSummary = meta.summary.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    // 태그 빈 배열 및 예외 처리
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

  console.log("🎉 모든 노션 글 동기화 작업이 성공적으로 완료되었습니다.");
}

syncNotionToJekyll().catch((err: unknown) => {
  console.error("동기화 도중 오류 발생:", err);
  process.exit(1);
});