import { Client } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

if (!NOTION_API_KEY) {
  console.error("NOTION_API_KEY 환경변수가 설정되지 않았습니다.");
  process.exit(1);
}
else if (!NOTION_DATABASE_ID) {
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

// 노션 데이터베이스 속성값 안전하게 추출
function parseNotionProperties(page: any): NotionPostProps {
  const props = page.properties;

  const title = props.title?.title[0]?.plain_text || "Untitled";

  // category: select 혹은 multi_select 처리
  const category = props.category?.select?.name ||
    (props.category?.multi_select && props.category.multi_select[0]?.name) ||
    "Uncategorized";

  // tag: multi_select 처리
  const tags = props.tag?.multi_select ? props.tag.multi_select.map((t: any) => t.name) : [];

  // slug: 입력된 값이 없으면 page ID로 대체
  const slug = props.slug?.rich_text[0]?.plain_text || page.id.replace(/-/g, "");

  const summary = props.summary?.rich_text[0]?.plain_text || "";
  const published = props.published?.checkbox || false;

  // 날짜 처리 (설정되지 않은 경우 생성시각/수정시각 활용)
  const publishedAt = props.publishedAt?.date?.start || page.created_time.split("T")[0];
  const updatedAt = props.updatedAt?.date?.start ||
    props.updatedAt?.last_edited_time?.split("T")[0] ||
    page.last_edited_time.split("T")[0];

  return { title, category, tags, slug, summary, published, publishedAt, updatedAt };
}

async function syncNotionToJekyll() {
  console.log("노션 데이터베이스에서 발행 글 수집 시작...");

  // published 속성이 true인 항목만 가져오기
  const response: any = await notion.request({
    path: `/databases/${NOTION_DATABASE_ID}/query`,
    method: "post",
    body: {
      filter: {
        property: "published",
        checkbox: {
          equals: true,
        },
      },
    },
  });

  console.log(`동기화 대상 게시글: 총 ${response.results.length}개`);

  const targetDir = path.join(process.cwd(), "_posts");
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const page of response.results) {
    const meta = parseNotionProperties(page);

    // 1. 노션 블록들을 마크다운 텍스트로 변환
    const mdblocks = await n2m.pageToMarkdown(page.id);
    const mdObject = n2m.toMarkdownString(mdblocks);
    const contentBody = mdObject.parent;

    // 2. Minimal Mistakes Jekyll 용 Front Matter 생성
    const frontMatter = `---
title: "${meta.title.replace(/"/g, '\\"')}"
date: ${meta.publishedAt}
last_modified_at: ${meta.updatedAt}
categories:
  - "${meta.category}"
tags:
${meta.tags.map((t) => `  - "${t}"`).join("\n")}
excerpt: "${meta.summary.replace(/"/g, '\\"')}"
toc: true
toc_sticky: true
---

`;

    const fullMarkdownContent = frontMatter + contentBody;

    // 3. 파일명 규칙 지정: YYYY-MM-DD-slug.md
    const fileName = `${meta.publishedAt}-${meta.slug}.md`;
    const filePath = path.join(targetDir, fileName);

    // 4. 파일 쓰기 (기존에 이미 존재하는 파일이면 내역 업데이트됨)
    fs.writeFileSync(filePath, fullMarkdownContent, "utf8");
    console.log(`업데이트 완료: ${fileName}`);
  }

  console.log("🎉 모든 노션 글 동기화 작업이 성공적으로 완료되었습니다.");
}

syncNotionToJekyll().catch((err) => {
  console.error("동기화 도중 오류 발생:", err);
  process.exit(1);
});