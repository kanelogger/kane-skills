# 代码风格

本文约束控制层手写脚本。当前使用原生 JavaScript ESM、双引号、分号、无尾逗号；运行入口与测试以 package.json 为准。接入具体语言或格式工具时同步更新本规则。

## 确定性机制

- 路由、重试、校验、解析和确定性转换优先使用普通代码或确定性工具，避免让模型重复承担可可靠执行的确定性步骤。
- 语义分类、初稿撰写、摘要、信息提取与取舍分析等依赖语义判断的工作可使用模型；是否引入模型能力仍由具体需求决定。

## 单位与范围

- 除非逻辑可组合或可复用，否则把相关代码留在同一个函数里。
- 只在拥有未知值的边界校验一次，向内传递已带类型的值。不重复 `typeof value === "object"` 与属性存在性检查，不对 schema、构造函数或内部类型已保证的值再做防御性校验。
- 不提前抽出只用一次的辅助函数。除非它会被复用、包住了确实复杂的边界，或者有一个清晰独立、能让调用方更好读的名字，否则内联在调用处。
- 为只是推测的竞态或安全边角情况增加复杂度之前，先说明具体失效模式、发生可能性的证据与复杂度代价并取得认可；无法判断时说明未知，不为理论上的健壮性悄悄扩大范围。
- 尽可能避免 `try`/`catch`：只在真的可能失败的外部边界（网络、解析、Storage）捕获并处理具体错误，不用它包住自己代码里的编程错误。
- 不使用 `any`（接入 TypeScript 时适用）；边界值用 `unknown` 加一次收窄。
- 依赖类型推断；只在导出、跨包契约或可读性需要时写显式类型标注或 `interface`。
- 变换数组优先 `flatMap` / `filter` / `map`，而不是 `for` 循环；在 `filter` 上用类型守卫保证下游推断。
- 一个值只用一次时内联，减少变量总数。

## 解构

避免不必要的解构，用点号访问保留上下文：

```ts
// 推荐
if (row.a === row.b) return;

// 不推荐
const { a, b } = row;
if (a === b) return;
```

## 导入

- 不给导入起别名：不写 `import { foo as bar } from "..."`，也不用 `resolve as pathResolve` 这类重命名。
- 不在类型位置写 `import("...")` 引用，例如 `Schema.declare<import("./types").Options>`。只有两个导入确实重名、再无其他办法时，才允许 `import type { Plugin as PluginDefinition } from "..."` 作为最后手段，即便如此也强烈不建议。
- 不使用星号导入：不写 `import * as Foo from "..."` 或 `import type * as Foo from "..."`。需要命名空间风格的值时，按名字导入模块自己导出的命名空间，再引用 `Namespace.member`。
- 只在特定代码路径才需要的重型模块用动态导入，启动敏感的入口尤其如此。在需要它的最窄作用域顶部解构绑定，让它读起来像普通导入：

```ts
if (needsChart) {
  const { renderChart } = await import("./chart");
  renderChart(data);
}
```

- 避免 `await import("./module").then((mod) => mod.value())` 或 `(await import("./module")).value()` 这类内联链式写法；只在某个分支用到的导入留在该分支内部，保持懒加载。

## 变量

优先使用 `const` 而不是 `let`。用三元表达式或提前返回来代替重新赋值。

```ts
// 推荐
const limit = isAdmin ? 100 : 20;

// 不推荐
let limit;
if (isAdmin) limit = 100;
else limit = 20;
```

## 控制流

避免 `else` 语句，优先使用提前返回。

```ts
// 推荐
function levelOf(role: Role) {
  if (role.isSuperAdmin) return "super";
  return "normal";
}

// 不推荐
function levelOf(role: Role) {
  if (role.isSuperAdmin) return "super";
  else return "normal";
}
```

## 复杂逻辑

当一个函数里有多个校验分支或支撑细节时，让主函数读起来就是正常路径，把支撑细节下移到它下面的小辅助函数里。

```ts
// 推荐
export function loadThing(input: unknown) {
  const config = requireConfig(input);
  const metadata = readMetadata(input);
  return createThing({ config, metadata });
}

function requireConfig(input: unknown) {
  // ...
}
```

- 让辅助函数靠近它所支持的代码；当下移到主导出之后更易读时，就那样放。
- 不要把一个简单表达式过度抽象成多个只用一次的辅助函数；只有当它命名了一个真实概念（例如 `requireConfig` 或 `readMetadata`）时才抽取。
- 为不直观的约束和出人意料的行为写注释，不要为显而易见的赋值或控制流写注释。
