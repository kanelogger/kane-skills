#!/usr/bin/env node

const DICE = [
  {
    label: "理论家",
    summaryLabel: "理论家",
    faces: [
      [1, "弗洛伊德"],
      [2, "齐泽克"],
      [3, "拉康"],
      [4, "福柯"],
      [5, "本雅明"],
      [6, "德勒兹"],
    ],
  },
  {
    label: "电影讨论的是啥",
    summaryLabel: "议题",
    faces: [
      [1, "欲望"],
      [2, "创伤"],
      [3, "记忆"],
      [4, "身份"],
      [5, "权力"],
      [6, "异化"],
    ],
  },
  {
    label: "分析对象",
    summaryLabel: "分析对象",
    faces: [
      [1, "身体"],
      [2, "家庭"],
      [3, "空间"],
      [4, "时间"],
      [5, "影像"],
      [6, "语言"],
    ],
  },
  {
    label: "高级名词",
    summaryLabel: "高级名词",
    faces: [
      [1, "他者"],
      [2, "凝视"],
      [3, "缺席"],
      [4, "能指"],
      [5, "规训"],
      [6, "主体"],
    ],
  },
  {
    label: "格局打开",
    summaryLabel: "时代框架",
    faces: [
      [1, "现代性"],
      [2, "后现代性"],
      [3, "技术理性"],
      [4, "资本主义"],
      [5, "数字时代"],
      [6, "景观社会"],
    ],
  },
  {
    label: "给出结论",
    summaryLabel: "结论",
    faces: [
      [1, "主体性的瓦解"],
      [2, "身份认同危机"],
      [3, "归属感消失"],
      [4, "现实边界模糊"],
      [5, "日常经验陌异化"],
      [6, "意义系统崩塌"],
    ],
  },
];

let array = [];

// 数组乱序
function shuffle(arr) {
  let i = arr.length;
  while (i) {
    let j = Math.floor(Math.random() * i--);
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 获取数组中的最后一项
function getLstMember(num = 1) {
  return array.slice(-num)
}

function rollDie(die) {
  array = shuffle([...die.faces]);
  const [face, word] = getLstMember(1)[0];
  return { ...die, face, word };
}

const results = DICE.map(rollDie);

for (const [index, result] of results.entries()) {
  console.log(`${index + 1}. ${result.label}：${result.face} - ${result.word}`);
}

const summary = results
  .map((result) => `${result.summaryLabel}=${result.word}`)
  .join(" / ");

console.log(`本轮汇总：${summary}`);
