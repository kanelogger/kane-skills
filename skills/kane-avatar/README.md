# kane-avatar

`kane-avatar` 用来把人物、宠物、物品照片或文字描述生成头像图，也可以生成宠物纪念卡，以及让真实人物从扁平景色中跃出的超现实纸艺作品。

## 使用示例

用照片生成头像：

```text
Use $kane-avatar to create an avatar from this photo.
```

指定头像风格：

```text
Use $kane-avatar to create a 像素头像 from this photo.
```

给宠物生成拍立得纪念卡：

```text
Use $kane-avatar to create a 拍立得纪念卡 for this pet. 宠物名：可乐。
```

指定自定义比例：

```text
Use $kane-avatar to create a 凌乱蜡笔宠物肖像, aspect ratio 4:5. 宠物名：奶茶。
```

纯文字描述头像：

```text
Use $kane-avatar to create a text-only 像素头像: a calm robot barista with a blue cap and square glasses.
```

纸感丙烯色块插画：

```text
Use $kane-avatar to create a 极简纸感丙烯色块插画 from this photo or theme:
一个人走向一架通往天空的楼梯
```

立体人物扁平景色纸艺（前后对比图）：

```text
Use $kane-avatar to create a 立体人物扁平景色纸艺 前后对比图 from this photo.
```

立体人物扁平景色纸艺（单张效果图）：

```text
Use $kane-avatar to create a 立体人物扁平景色纸艺 单张效果图 from this photo.
```

## 可用风格

| 风格 | Style ID | 对象 | 适合内容 |
| --- | --- | --- | --- |
| 像素头像 | `pixel-avatar` | 人、宠物、物品 | 标准头像、像素 IP、符号化头像 |
| 怪诞灵魂手绘 | `grotesque-soul-sketch` | 人、宠物 | 趣味头像、情绪化手绘肖像 |
| 凌乱蜡笔宠物肖像 | `messy-crayon-pet-portrait` | 宠物 | 宠物头像、宠物手绘肖像 |
| 时尚速写观察页 | `fashion-sketch-observation` | 人 | 人像头像、街拍和旅行观察页感肖像 |
| 拍立得纪念卡 | `polaroid-keepsake` | 宠物 | 宠物头像衍生卡片、宠物纪念图 |
| 极简纸感丙烯色块插画 | `minimal-paper-acrylic-block-illustration` | 人、宠物、物品、场景、主题 | 小主体、粗糙白纸、鲜明丙烯色块和大面积留白的纸感手绘插画 |
| 立体人物扁平景色纸艺 | `surreal-pop-up-paper-landscape` | 人、场景 | 真人保持立体，原照片环境向后翻倒并压扁为纸面景色；支持前后对比图与单张效果图 |
