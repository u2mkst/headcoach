/** 엠블럼 파일 목록 문서 생성: npx vite-node scripts/crestList.ts > docs/crests.md */
import { COMPETITIONS, CLUBS } from '../src/data/clubs'

const lines: string[] = [
  '# 엠블럼 파일 목록',
  '',
  '엠블럼은 저작권·상표가 있는 이미지라 저장소에 포함하지 않았습니다. 아래 파일명으로 직접 넣으면 앱이 자동으로 사용합니다.',
  '파일이 없으면 구단 색 방패에 첫 글자를 그린 기본 방패가 표시됩니다.',
  '',
  '- 구단: `public/assets/crests/<id>.png`',
  '- 대회: `public/assets/competitions/<id>.png`',
  '- 정사각형 PNG(투명 배경, 256×256 이상) 권장',
  '- 이름·경로는 `src/data/clubs.ts` 한 곳에서만 관리합니다',
  '',
  '> 실제 엠블럼을 공개 배포(GitHub Pages 등)하거나 수익을 낼 때는 상표·라이선스 확인이 필요합니다.',
  '',
  '## 대회',
  '',
  '| id | 대회 | 파일 |',
  '| --- | --- | --- |',
  ...COMPETITIONS.map((c) => `| ${c.id} | ${c.name} | \`public/assets/competitions/${c.id}.png\` |`),
  '',
]
const names: Record<string, string> = {
  k1: 'K리그1', k2: 'K리그2', epl: '프리미어리그', laliga: '라리가', bundesliga: '분데스리가',
  seriea: '세리에 A', ligue1: '리그 1', euother: '그 밖의 유럽 구단 (챔피언스리그 출전 풀)',
}
for (const lg of Object.keys(names)) {
  lines.push(`## ${names[lg]}`, '', '| id | 구단 | 파일 |', '| --- | --- | --- |')
  for (const c of CLUBS.filter((x) => x.league === lg)) lines.push(`| ${c.id} | ${c.name} | \`public/assets/crests/${c.id}.png\` |`)
  lines.push('')
}
console.log(lines.join('\n'))
