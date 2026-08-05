import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import type { PageObjectResponse, RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const validFiles = new Set<string>();

const cleanDatabaseId = (id: string | undefined): string => {
  if (!id) return "";
  const match = id.replace(/-/g, "").match(/[a-f0-9]{32}/i);
  return match ? match[0] : id.trim();
};

const NOTION_DATABASE_ID = cleanDatabaseId(process.env.NOTION_DATABASE_ID);

if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
} else if (!NOTION_DATABASE_ID) {
  console.error("NOTION_DATABASE_ID 환경변수가 설정되지 않았거나 유효하지 않습니다.");
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

function getProperty(props: PageObjectResponse["properties"], keyName: string) {
  const targetKey = Object.keys(props).find(
    (k) => k.toLowerCase() === keyName.toLowerCase()
  );
  return targetKey ? props[targetKey] : undefined;
}

function parseNotionProperties(page: PageObjectResponse): NotionPostProps {
  const props = page.properties;

  // 1. Title 추출 (기본값을 빈 문자열로 변경)
  let title = "";
  const titleProp = Object.values(props).find((p) => p.type === "title") || getProperty(props, "Title");

  if (titleProp && titleProp.type === "title" && Array.isArray(titleProp.title) && titleProp.title.length > 0) {
    const extractedTitle = (titleProp.title as RichTextItemResponse[])
      .map((t: RichTextItemResponse) => t.plain_text)
      .join("")
      .trim();
    if (extractedTitle) {
      title = extractedTitle;
    }
  }

  // 2. Category (Select)
  const categoryProp = getProperty(props, "Category");
  const category = categoryProp?.type === "select" && categoryProp.select?.name
    ? categoryProp.select.name
    : "Uncategorized";

  // 3. Tag (Multi-select)
  const tagProp = getProperty(props, "Tag");
  const tags = tagProp?.type === "multi_select" && Array.isArray(tagProp.multi_select)
    ? tagProp.multi_select.map((t) => t.name)
    : [];

  // 4. Slug
  const slugProp = getProperty(props, "Slug");
  const slugText = slugProp?.type === "rich_text" && Array.isArray(slugProp.rich_text)
    ? (slugProp.rich_text as RichTextItemResponse[]).map((t: RichTextItemResponse) => t.plain_text).join("").trim()
    : "";
  const slug = slugText || page.id.replace(/-/g, "");

  // 5. Summary
  const summaryProp = getProperty(props, "Summary");
  const summary = summaryProp?.type === "rich_text" && Array.isArray(summaryProp.rich_text)
    ? (summaryProp.rich_text as RichTextItemResponse[]).map((t: RichTextItemResponse) => t.plain_text).join("").trim()
    : "";

  // 6. Published (Checkbox)
  const publishedProp = getProperty(props, "Published");
  const published = publishedProp?.type === "checkbox" ? publishedProp.checkbox : false;

  // 7. PublishedAt (Date)
  const publishedAtProp = getProperty(props, "PublishedAt");
  const publishedAt = publishedAtProp?.type === "date" && publishedAtProp.date?.start
    ? publishedAtProp.date.start
    : page.created_time.split("T")[0];

  // 8. UpdatedAt (Date)
  const updatedAtProp = getProperty(props, "UpdatedAt");
  const updatedAt = updatedAtProp?.type === "date" && updatedAtProp.date?.start
    ? updatedAtProp.date.start
    : page.last_edited_time.split("T")[0];

  return { title, category, tags, slug, summary, published, publishedAt, updatedAt };
}

async function syncNotionToJekyll(): Promise<void> {
  console.log("노션 데이터베이스에서 발행 글 수집 시작...");

  const response = await notion.dataSources.query({
    data_source_id: NOTION_DATABASE_ID,
    filter: {
      property: "Published",
      checkbox: {
        equals: true,
      },
    },
  });

  type QueryResultItem = typeof response.results[number];

  const pages = response.results.filter(
    (result: QueryResultItem): result is PageObjectResponse =>
      typeof result === "object" && result !== null && "properties" in result
  );

  console.log(`동기화 대상 게시글: 총 ${pages.length}개`);

  const targetDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const page of pages) {
    const meta = parseNotionProperties(page);

    // 🚨 [방어 로직] 제목이 없거나 Untitled인 임시/빈 페이지는 생성 스킵
    if (!meta.title || meta.title.toLowerCase() === "untitled") {
      console.warn(`⚠️ 제목이 비어있어 스킵된 페이지 ID: ${page.id}`);
      continue;
    }

    const mdblocks = await n2m.pageToMarkdown(page.id);
    const mdObject = n2m.toMarkdownString(mdblocks);
    const contentBody = mdObject.parent || "";

    const safeTitle = meta.title
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n|\r/g, " ");
    const safeSummary = meta.summary
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n|\r/g, " ");

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

    // 유효한 파일만 목록에 기록 및 파일 생성
    validFiles.add(fileName);
    fs.writeFileSync(filePath, fullMarkdownContent, "utf8");
    console.log(`업데이트 완료: ${fileName} [제목: ${meta.title}]`);
  }

  console.log("기존 _posts 폴더 내 cleanup 검사 시작...");
  const existingFiles = fs.readdirSync(targetDir);

  for (const file of existingFiles) {
    if (file.endsWith(".md") && !validFiles.has(file)) {
      const removePath = path.join(targetDir, file);
      fs.unlinkSync(removePath);
      console.log(`비활성 글 제거 완료: ${file}`);
    }
  }

  console.log("모든 게시글 동기화 작업이 완료되었습니다.");
}

syncNotionToJekyll().catch((err: unknown) => {
  console.error("동기화 도중 오류 발생:", err);
  process.exit(1);
});