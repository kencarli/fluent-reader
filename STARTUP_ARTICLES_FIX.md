# 修复：启动时自动显示文章 & RSS XML 解析崩溃

## 修复 1: 启动时自动显示文章

### 问题描述
软件启动后显示"无文章"，需要点击订阅源后才能显示文章列表。

### 根本原因
在 `src/scripts/models/app.ts` 的 `initApp()` 函数中，初始化流程存在时序问题：

```typescript
// 修复前的代码
await dispatch(fetchItems(true))  // 等待完成
dispatch(initFeeds())             // ❌ 不等待完成
dispatch(selectAllArticles(true)) // 立即执行，此时 feeds 可能还未加载
```

`initFeeds()` 是一个异步操作，但代码没有等待它完成就执行了 `selectAllArticles(true)`，导致页面渲染时 feed 数据还未准备好。

### 解决方案
在 `initFeeds()` 前添加 `await`，确保 feeds 加载完成后再渲染页面：

```typescript
// 修复后的代码
await dispatch(fetchItems(true))      // 等待完成
await dispatch(initFeeds())           // ✅ 等待 feeds 加载完成
dispatch(selectAllArticles(true))     // 现在可以安全渲染
```

### 修改文件
- `src/scripts/models/app.ts` (第 783 行)

---

## 修复 2: RSS XML 解析崩溃（UTF-8 字符边界问题）

### 问题描述
应用启动时出现 Rust panic 错误：
```
thread 'tokio-rt-worker' panicked at src\main.rs:57:26:
byte index 182 is not a char boundary; it is inside '资' (bytes 181..184)
```

当 RSS feed 包含中文字符（如"听力行业新闻资讯"）时，应用崩溃。

### 根本原因
在 `src-tauri/src/main.rs` 的 `clean_rss_xml` 函数中，使用字节索引来检测 CDATA 标记：

```rust
// 修复前的代码 - 第 57 行
if !in_tag && xml[std::cmp::max(0, cleaned.len().saturating_sub(8))..].ends_with("<![CDATA") {
    in_cdata = true;
}
```

问题：
- `cleaned.len()` 返回的是**字节长度**，不是字符数量
- 中文字符在 UTF-8 中占用 3 个字节
- 当切片位置落在多字节字符中间时，Rust 会 panic

### 解决方案
使用字符缓冲区替代字节索引：

```rust
// 修复后的代码
let mut char_buffer: Vec<char> = Vec::with_capacity(10);

while let Some(c) = chars.next() {
    // 检测 CDATA 区域 - 使用字符缓冲区而不是字节索引
    char_buffer.push(c);
    if char_buffer.len() > 10 {
        char_buffer.remove(0);
    }
    
    if !in_tag {
        let buffer_str: String = char_buffer.iter().collect();
        if buffer_str.ends_with("<![CDATA") {
            in_cdata = true;
        }
    }
    // ...
}
```

优点：
- ✅ 完全避免 UTF-8 字符边界问题
- ✅ 使用字符而非字节进行切片
- ✅ 性能影响很小（只保存最近 10 个字符）

### 修改文件
- `src-tauri/src/main.rs` (第 48-73 行)

---

## 测试步骤

### 测试 1: 启动时文章显示
1. 启动应用：`npm run tauri dev`
2. 观察启动后的主界面
3. 确认文章列表自动显示，无需手动点击订阅源

### 测试 2: 中文 RSS 解析
1. 添加包含中文字符的 RSS 源（如 `https://www.hearingtracker.com/news`）
2. 刷新订阅源
3. 确认应用不崩溃，正常解析和显示中文内容

## 预期效果
- ✅ 启动后自动显示所有文章（根据默认过滤器设置）
- ✅ 不再显示"无文章"提示（假设有订阅源和文章数据）
- ✅ 正确处理包含中文、日文、韩文等多字节字符的 RSS feed
- ✅ 用户体验更流畅，无需额外操作
