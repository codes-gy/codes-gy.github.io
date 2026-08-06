---
title: "나의 첫 Next.js 블로그 개발"
date: 2026-06-10
last_modified_at: 2026-08-05
categories:
  - "리액트"
tags:
  []
excerpt: "Notion API를 활용해서 블로그 데이터를 가져오는 방법을 정리합니다."
toc: true
toc_sticky: true
---


### 💻 프로젝트 핵심 요약


> 💡 Next.js를 활용해 마크다운 기반의 정적 블로그를 구현한 첫 풀스택 웹 개발 프로젝트입니다.  
> - **개발 기간:** 2026.05.03 ~ 2026.06.12  
>   
> - **사용한 기술 스택:** Next.js, React, Tailwind CSS, TypeScript, Vercel  
>   
> - **배포 링크:** `[`[https://dev-blog-topaz-rho.vercel.app/](https://dev-blog-topaz-rho.vercel.app/)`]`  
>   
> - **GitHub 레포지토리:** `[`[https://github.com/codes-gy/dev-blog](https://github.com/codes-gy/dev-blog)`]`


# 나의 첫 Next.js 블로그 개발기


개발 공부를 하면서 늘 아쉬웠던 점이 있었다.


분명히 공부는 했는데, 시간이 지나면 내가 무엇을 배웠는지 흐릿해진다는 점이었다.


그래서 공부한 내용을 기록할 수 있는 블로그를 만들고 싶었다. 처음에는 Velog나 Tistory 같은 기존 플랫폼을 사용할까 고민했지만, 직접 만들어보면 Next.js도 더 깊게 이해할 수 있고, 내가 원하는 기능도 자유롭게 넣을 수 있을 것 같았다.


이번 프로젝트의 목표는 단순했다.

> Notion에 글을 작성하면 Next.js 블로그에 자동으로 반영되는 개발 블로그 만들기

하지만 실제로 구현해보니 단순한 블로그처럼 보여도 안에는 꽤 많은 기능이 필요했다.


---


# 사용한 기술 스택


이번 프로젝트에서는 다음 기술을 사용했다.

- Next.js
- TypeScript
- Tailwind CSS
- Notion API
- Notion Data Source
- App Router

프로젝트는 Next.js 기반으로 만들었다.


```bash
npx create-next-app@latest dev-blog
```


TypeScript와 App Router를 사용했고, 스타일링은 Tailwind CSS로 처리했다.


---


# Notion을 CMS로 사용하기


블로그 글을 직접 DB에 저장하는 대신 Notion을 CMS처럼 사용하기로 했다.


Notion 데이터베이스에는 다음 속성을 만들었다.


| 속성          | 타입   | 설명     |
| ----------- | ---- | ------ |
| Title       | 제목   | 글 제목   |
| Slug        | 텍스트  | URL 주소 |
| Summary     | 텍스트  | 글 요약   |
| Category    | 선택   | 카테고리   |
| PublishedAt | 날짜   | 발행일    |
| Published   | 체크박스 | 공개 여부  |


예를 들면 다음과 같은 형태다.


```plain text
Title: 나의 첫 Next.js 블로그 개발기
Slug: first-nextjs-blog
Summary: Next.js와 Notion API를 연결해 블로그를 만든 과정
Category: Next.js
PublishedAt: 2026-06-10
Published: true
```


여기서 `Published`를 체크한 글만 블로그에 노출되도록 만들었다.


---


# Notion API 연결하기


먼저 Notion SDK를 설치했다.


```bash
npm install @notionhq/client
```


그리고 서버 전용 데이터 파일을 만들었다.


```typescript
import "server-only";
import { Client } from "@notionhq/client";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATA_SOURCE_ID = process.env.NOTION_DATA_SOURCE_ID;
```


환경변수는 다음과 같이 설정했다.


```plain text
NOTION_API_KEY=secret_xxxxx
NOTION_DATA_SOURCE_ID=xxxxx
```


처음에는 `DATABASE_ID`를 사용하려고 했는데, 최신 Notion API에서는 `dataSources.query()`를 사용해야 했다.


```typescript
const response = await notion.dataSources.query({
  data_source_id: DATA_SOURCE_ID,
});
```


이 부분에서 꽤 오래 헤맸다.


Database ID와 Data Source ID가 다르다는 점을 몰랐기 때문이다.


---


# 게시글 목록 가져오기


게시글 목록은 Notion Data Source에서 가져왔다.


가장 기본적인 조건은 다음과 같았다.

- Published가 true인 글만 가져오기
- PublishedAt 기준으로 최신순 정렬
- 한 번에 일정 개수만 가져오기

```typescript
const response = await notion.dataSources.query({
  data_source_id: DATA_SOURCE_ID,
  page_size: 6,
  filter: {
    property: "Published",
    checkbox: {
      equals: true,
    },
  },
  sorts: [
    {
      property: "PublishedAt",
      direction: "descending",
    },
  ],
});
```


가져온 데이터를 화면에서 사용하기 쉽도록 `Post` 타입으로 변환했다.


```typescript
export interface Post {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  publishedAt: string;
  category: string;
}
```


그리고 Notion page 객체를 내가 사용할 데이터 형태로 매핑했다.


```typescript
return {
  id: page.id,
  title: getText(props["Title"]) || "제목 없음",
  slug: getText(props["Slug"]),
  description: getText(props["Summary"]) || "본문 요약문이 없습니다.",
  category: getSelect(props["Category"]) || "일반",
  publishedAt: getDate(props["PublishedAt"]) || "날짜 미정",
  coverImage: getCover(page),
};
```


---


# 게시글 카드 UI 만들기


목록 화면에서는 글을 카드 형태로 보여주었다.


카드에는 다음 정보를 넣었다.

- 커버 이미지
- 카테고리
- 작성일
- 제목
- 요약문
- 더 읽어보기 버튼

```
<Link href={`/posts/${post.slug}`}>
  <div className="aspect-[16/9] overflow-hidden">
    <img
      src={post.coverImage}
      alt={post.title}
      className="w-full h-full object-cover"
    />
  </div>

  <div className="p-6">
    <span>{post.publishedAt}</span>
    <h2>{post.title}</h2>
    <p>{post.description}</p>
  </div>
</Link>
```


처음에는 단순히 텍스트만 출력했지만, 커버 이미지와 카테고리 배지를 넣으니 훨씬 블로그다운 느낌이 났다.


---


# 상세 페이지 만들기


상세 페이지는 App Router의 동적 라우팅을 사용했다.


파일 구조는 다음과 같다.


```plain text
app/posts/[slug]/page.tsx
```


URL은 이런 형태로 만들어진다.


```plain text
/posts/first-nextjs-blog
```


상세 페이지에서는 `slug` 값을 받아 Notion에서 해당 글을 조회했다.

{% raw %}
```
export default async function PostDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const content = await getPostContent(post.id);

  return (
    <main>
      <h1>{post.title}</h1>
      <article dangerouslySetInnerHTML={{ __html: content }} />
    </main>
  );
}
```
{% endraw %}

글이 존재하지 않거나 Published가 false라면 `notFound()`를 호출해서 404 페이지로 보내도록 했다.


---


# Notion 본문 렌더링


Notion의 본문은 단순 문자열이 아니라 블록 구조로 되어 있다.


예를 들어 글 하나 안에도 다음과 같은 블록들이 있다.

- heading
- paragraph
- image
- code
- callout
- bulleted list
- numbered list

그래서 단순히 page 데이터만 가져와서는 본문을 출력할 수 없었다.


본문 블록은 다음 API로 가져왔다.


```typescript
const response = await notion.blocks.children.list({
  block_id: blockId,
});
```


하지만 여기서도 문제가 있었다.


블록이 많거나 자식 블록이 있는 경우 한 번에 전부 가져오지 못할 수 있었다.


그래서 재귀적으로 모든 child block을 가져오는 함수를 만들었다.


```typescript
async function fetchAllChildBlocks(id: string): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let hasMore = true;
  let cursor: string | undefined = undefined;

  while (hasMore) {
    const response = await notion.blocks.children.list({
      block_id: id,
      start_cursor: cursor,
      page_size: 100,
    });

    const fullBlocks = response.results.filter(isFullBlock);
    blocks.push(...fullBlocks);

    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  return blocks;
}
```


이후 블록 타입별로 HTML을 만들어주었다.


```typescript
switch (block.type) {
  case "heading_1":
    html += `<h1>${text}</h1>`;
    break;

  case "paragraph":
    html += `<p>${text}</p>`;
    break;

  case "code":
    html += `<pre><code>${code}</code></pre>`;
    break;
}
```


이 작업을 하면서 Notion이 내부적으로 얼마나 블록 중심으로 동작하는지 알게 되었다.


---


# 다크모드 대응


Tailwind CSS의 `dark:` 클래스를 사용해 다크모드를 적용했다.


```
<main className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
  ...
</main>
```


하지만 Notion Callout 블록에서 문제가 생겼다.


라이트모드에서는 잘 보이던 callout 제목이 다크모드에서는 거의 보이지 않았다.


그래서 callout 렌더링 부분을 수정했다.


```typescript
html += `
  <div class="my-4 flex gap-3 p-4 rounded-xl border
              border-slate-200/50 dark:border-slate-800/30
              bg-slate-100 text-slate-800
              dark:bg-slate-800/70 dark:text-slate-100">
    ${iconHtml}
    <div class="flex-1 min-w-0 leading-relaxed text-sm md:text-base">
      <div class="font-bold text-slate-900 dark:text-white">
        ${text}
      </div>
      ${childrenHtml}
    </div>
  </div>
`;
```


색상을 변수로 복잡하게 처리하기보다, 우선 가독성이 확실하게 보장되도록 수정했다.


---


# 카테고리 필터 구현


카테고리는 Notion의 `Category` 속성을 기준으로 필터링했다.


```typescript
if (category && category !== "전체") {
  filterAndArray.push({
    property: "Category",
    select: {
      equals: category,
    },
  });
}
```


기본값은 `전체`로 두고, 특정 카테고리를 선택하면 해당 카테고리의 글만 보여주도록 만들었다.


또한 카테고리 목록은 직접 하드코딩하지 않고 Notion 데이터에서 가져오도록 했다.


```typescript
const categoriesSet = new Set<string>();
categoriesSet.add("전체");

response.results.filter(isFullPage).forEach((page) => {
  const category = getSelect(page.properties["Category"]);

  if (category) {
    categoriesSet.add(category);
  }
});
```


이렇게 하면 Notion에서 새로운 카테고리를 추가해도 코드 수정 없이 자동으로 반영된다.


---


# 제목 검색 기능


검색 기능은 Title 속성을 기준으로 구현했다.


```typescript
if (searchText && searchText.trim() !== "") {
  filterAndArray.push({
    property: "Title",
    title: {
      contains: searchText.trim(),
    },
  });
}
```


사용자가 검색어를 입력하면 Notion API에 필터 조건을 함께 전달한다.


결과적으로 다음 조건이 조합된다.


```plain text
Published = true
AND Category = 선택한 카테고리
AND Title contains 검색어
```


검색과 카테고리 필터를 따로 처리하지 않고 하나의 filter 배열로 조합한 점이 깔끔했다.


---


# 검색 태그 기능


카테고리보다 더 세밀하게 글을 분류하기 위해 태그 검색 기능도 추가했다.


카테고리는 보통 하나의 큰 분류지만, 태그는 하나의 글에 여러 개를 붙일 수 있다.


예를 들어 이 글에는 다음과 같은 태그를 붙일 수 있다.


```plain text
Next.js
Notion API
TypeScript
Blog
App Router
```


태그 필터는 Notion의 multi_select 속성을 기준으로 구현할 수 있다.


```typescript
filterAndArray.push({
  property: "Tags",
  multi_select: {
    contains: selectedTag,
  },
});
```


이 기능을 추가하면서 카테고리와 태그의 역할을 분리할 수 있었다.


카테고리는 글의 큰 주제, 태그는 글의 세부 키워드로 사용했다.


---


# 커서 기반 페이징 처리


처음에는 모든 글을 한 번에 가져오도록 만들었다.


하지만 글이 많아지면 초기 로딩이 느려질 수 있다고 생각했다. 그래서 Notion API의 `next_cursor`를 활용해 커서 기반 페이징을 구현했다.


```typescript
export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}
```


게시글 조회 함수는 다음 커서를 함께 반환하도록 만들었다.


```typescript
return {
  posts,
  nextCursor: response.next_cursor ?? null,
};
```


Notion API를 호출할 때는 `page_size`와 `start_cursor`를 전달했다.


```typescript
const response = await notion.dataSources.query({
  data_source_id: DATA_SOURCE_ID,
  page_size: pageSize,
  start_cursor: startCursor,
  filter: {
    and: filterAndArray,
  },
});
```


이 방식은 페이지 번호 방식과 다르게, 다음 데이터를 불러올 위치를 서버가 알려준다.


그래서 Notion API와 잘 맞는 방식이었다.


---


# 좋아요 기능


글에 대한 가벼운 반응을 받을 수 있도록 좋아요 기능도 추가했다.


좋아요는 댓글보다 부담이 적기 때문에 방문자가 쉽게 반응할 수 있다.


구현 방식은 게시글의 slug를 기준으로 좋아요 수를 조회하고 증가시키는 구조로 만들었다.


```typescript
await incrementLikeCount(slug);
```


상세 페이지에서는 좋아요 수를 보여준다.


```
<button>
  좋아요 {likeCount}
</button>
```


추가로 같은 사용자가 여러 번 누르는 것을 막기 위해 localStorage나 쿠키를 활용할 수도 있다.


```typescript
const likedKey = `liked-${slug}`;

if (!localStorage.getItem(likedKey)) {
  await incrementLikeCount(slug);
  localStorage.setItem(likedKey, "true");
}
```


---


# 조회수 기능


조회수 기능도 구현했다.


상세 페이지에 접근할 때 해당 글의 조회수를 증가시키는 방식이다.


```typescript
await increaseViewCount(slug);
```


조회수는 글의 인기도를 확인하는 데 도움이 된다.


단, 새로고침할 때마다 조회수가 계속 올라갈 수 있기 때문에 정확도를 높이려면 IP, 쿠키, 세션 등을 고려해야 한다.


이번 프로젝트에서는 먼저 기본 동작을 구현하고, 이후 중복 집계 방지 로직을 개선하는 방향으로 잡았다.


---


# 댓글 기능


댓글 기능은 게시글 상세 페이지 하단에 추가했다.


댓글은 특정 글에 연결되어야 하므로 `slug`를 기준으로 저장했다.


```typescript
await createComment({
  slug,
  author,
  content,
});
```


댓글 목록을 가져올 때도 같은 slug를 기준으로 조회한다.


```typescript
const comments = await getComments(slug);
```


화면에서는 다음과 같이 출력했다.


```
{comments.map((comment) => (
  <div key={comment.id}>
    <strong>{comment.author}</strong>
    <p>{comment.content}</p>
  </div>
))}
```


댓글 기능을 구현하면서 단순히 글을 보여주는 블로그에서, 방문자와 상호작용할 수 있는 블로그로 확장되는 느낌이 들었다.


---


# RSS Feed 구현


블로그 글을 외부에서 구독할 수 있도록 RSS Feed도 만들었다.


RSS는 새 글이 올라왔을 때 구독자가 업데이트를 받을 수 있게 해준다.


Next.js에서는 라우트 핸들러를 이용해 RSS XML을 생성할 수 있다.


```typescript
export async function GET() {
  const { posts } = await getBlogPosts(100);

  const items = posts
    .map((post) => `
      <item>
        <title>${post.title}</title>
        <link>https://example.com/posts/${post.slug}</link>
        <description>${post.description}</description>
        <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      </item>
    `)
    .join("");

  const rss = `
    <rss version="2.0">
      <channel>
        <title>DevLog.io</title>
        <link>https://example.com</link>
        <description>개발 기록 블로그</description>
        ${items}
      </channel>
    </rss>
  `;

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
```


블로그가 단순히 웹페이지로만 존재하는 것이 아니라, 구독 가능한 콘텐츠 채널이 된다는 점이 좋았다.


---


# Sitemap 구현


검색엔진이 블로그의 글을 더 잘 찾을 수 있도록 Sitemap도 구현했다.


Next.js에서는 `sitemap.ts` 파일을 통해 동적으로 sitemap을 만들 수 있다.


```typescript
export default async function sitemap() {
  const { posts } = await getBlogPosts(100);

  return posts.map((post) => ({
    url: `https://example.com/posts/${post.slug}`,
    lastModified: new Date(post.publishedAt),
  }));
}
```


이렇게 하면 Notion에 새 글을 추가했을 때 sitemap에도 자동으로 반영된다.


SEO를 고려한다면 꼭 필요한 기능이라고 생각했다.


---


# 캐시 문제 해결


개발 중 가장 헷갈렸던 문제 중 하나가 캐시였다.


Notion에서 `Published` 체크를 해제했는데, 상세 페이지에서는 사라졌지만 목록 페이지에서는 계속 보였다.


원인은 Next.js의 캐시였다.


이를 해결하기 위해 페이지에 다음 설정을 추가했다.


```typescript
export const dynamic = "force-dynamic";
export const revalidate = 0;
```


이 설정을 추가하면 해당 페이지는 캐시된 데이터를 사용하지 않고 매번 새롭게 데이터를 가져온다.


Notion처럼 외부 CMS를 실시간으로 반영해야 하는 경우에는 중요한 설정이었다.


---


# 가장 많이 배운 점


이번 프로젝트를 만들면서 단순히 Next.js 화면을 만드는 것보다 훨씬 많은 것을 배웠다.


특히 기억에 남는 점은 다음과 같다.

- Notion API의 Data Source 구조
- 서버 컴포넌트에서 데이터 가져오기
- App Router의 동적 라우팅
- 외부 CMS 데이터 캐싱 문제
- 블록 기반 콘텐츠 렌더링
- 커서 기반 페이징
- SEO를 위한 Sitemap과 RSS
- 사용자 반응 기능 구현

처음에는 단순히 글 목록과 상세 페이지 정도만 생각했지만, 구현하다 보니 실제 블로그 서비스에 필요한 기능을 꽤 많이 경험할 수 있었다.


---


# 마무리


이번 프로젝트는 나에게 꽤 의미 있는 첫 Next.js 블로그 프로젝트였다.


기존 블로그 플랫폼을 사용하는 대신 직접 만들었기 때문에, 중간중간 막히는 부분도 많았다. 하지만 그만큼 얻은 것도 많았다.


특히 Notion을 CMS로 사용하고, Next.js에서 이를 화면으로 렌더링하는 구조를 직접 구현해본 것이 가장 큰 경험이었다.


앞으로 이 블로그에는 공부한 내용, 프로젝트 회고, 개발하면서 만난 문제들을 꾸준히 기록할 예정이다.


처음 만든 블로그라 아직 개선할 부분은 많지만, 직접 만든 공간이라는 점에서 더 애착이 간다.

