// 파파 멤버 명단 — 처음 로그인할 때 "나는 누구예요?"에서 고르는 목록
// team: VD(비주얼) / ID(인더스트리얼)
const MEMBERS = [
  { name: "보아", team: "VD", role: "디렉터", group: "디렉터" },
  { name: "규호", team: "ID", role: "디렉터", group: "디렉터" },
  { name: "준구", team: "ID", role: "디렉터", group: "디렉터" },
  { name: "유진", team: "ID", role: "시니어 디자이너", group: "임직원" },
  { name: "현열", team: "ID", role: "시니어 디자이너", group: "임직원" },
  { name: "진우", team: "ID", role: "디자이너", group: "임직원" },
  { name: "다은", team: "ID", role: "디자이너", group: "임직원" },
  { name: "태영", team: "ID", role: "디자이너", group: "임직원" },
  { name: "경선", team: "ID", role: "디자이너", group: "임직원" },
  { name: "준범", team: "ID", role: "프리랜서 디자이너", group: "임직원" },
  { name: "수현", team: "VD", role: "디자이너", group: "임직원" },
  { name: "혜경", team: "VD", role: "디자이너", group: "임직원" },
  { name: "지민", team: "VD", role: "디자이너", group: "임직원" },
  { name: "여준", team: "ID", role: "인턴", group: "임직원" },
  { name: "민지", team: "VD", role: "인턴", group: "임직원" },
];
if (typeof window !== "undefined") window.MEMBERS = MEMBERS;
if (typeof module !== "undefined") module.exports = MEMBERS;
