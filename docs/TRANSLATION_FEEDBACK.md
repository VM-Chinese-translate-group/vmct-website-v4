# 汉化意见征集后台编辑指南

本功能的编辑工作全部在 ECS SQLite 数据库 中完成。前端只负责公开展示、提交建议和点赞；编辑人员不需要调用接口、配置 Wrangler 或部署 Worker。

## 进入正确的数据库

在 ECS 上使用 SQLite 工具打开：

```text
/var/lib/vmct-website/data/translation-feedback.sqlite
```

请确认使用的是 `/var/lib/vmct-website/data/translation-feedback.sqlite`，不要与其他项目共用数据库文件。

每次编辑都遵循：

1. 先用 `SELECT` 查询并确认目标行。
2. 再执行范围明确的 `UPDATE`。
3. 再次 `SELECT` 检查结果。

所有时间字段统一使用：

```sql
strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
```

## 查询项目

按热度查看公开项目：

```sql
SELECT
  id,
  display_name,
  category,
  subtype,
  subtypes,
  status,
  cover_url,
  cover_platform,
  vote_count,
  updated_at
FROM feedback_items
ORDER BY vote_count DESC, created_at ASC;
```

按名称查找：

```sql
SELECT *
FROM feedback_items
WHERE display_name LIKE '%项目名称%';
```

查来源和别名：

```sql
SELECT item_id, platform, url, normalized_url, external_id, is_primary
FROM feedback_sources
WHERE item_id = '项目 ID';

SELECT item_id, alias, normalized_alias
FROM feedback_aliases
WHERE item_id = '项目 ID';
```

## 修改状态或隐藏项目

允许的状态值：

```text
candidate
planned
translating
completed
hidden
```

下架项目时使用 `hidden`，不要直接删除项目行：

```sql
UPDATE feedback_items
SET
  status = 'planned',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

隐藏项目：

```sql
UPDATE feedback_items
SET
  status = 'hidden',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

## 设置或清除封面

提交新项目或补充来源时，Worker 会尝试自动获取 CurseForge 或 Modrinth 的项目封面。Modrinth 使用公开项目接口；CurseForge 需要维护者在 Worker Secret 中配置 `CURSEFORGE_API_KEY`。接口超时、限流、项目没有封面或没有配置密钥时，提交仍会成功，`cover_url` 为空属于正常情况，前端会显示 `/imgs/missing.png`。

自动获取只会补全当前没有封面的项目，不会覆盖编辑人员已经设置的封面。自动获取失败时，可以继续在 SQLite 中手动填写封面。

设置封面时，同时填写地址和来源平台：

```sql
UPDATE feedback_items
SET
  cover_url = 'https://example.com/cover.png',
  cover_platform = 'Modrinth',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

清除封面时，两列一起设为 `NULL`：

```sql
UPDATE feedback_items
SET
  cover_url = NULL,
  cover_platform = NULL,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

封面地址必须是稳定、公开可访问的 HTTPS 图片地址。修改后刷新意见征集页面确认图片能够加载。

## 修改项目类型

`subtype` 是兼容旧数据的主类型，`subtypes` 是逗号分隔的完整类型列表。两者必须同步，并且 `subtype` 必须等于 `subtypes` 的第一项。

整合包示例：

```sql
UPDATE feedback_items
SET
  subtype = 'technology',
  subtypes = 'technology,magic',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

整合包可用类型：`technology`、`adventure`、`kitchen_sink`、`magic`、`other`。

地图可用类型：`puzzle`、`minigame`、`adventure`、`horror`、`parkour`、`other`。

## 修改名称和补充别名

修改显示名称时同步修改规范化名称：

```sql
UPDATE feedback_items
SET
  display_name = '新的显示名称',
  normalized_name = '新的显示名称的小写规范化形式',
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = '项目 ID';
```

如果旧名称仍然可能被玩家使用，建议在 `feedback_aliases` 中保留旧名称。`normalized_alias` 应填写与 Worker 相同规则生成的规范化文本，以便候选匹配继续生效。

不要手动修改 `id` 或 `canonical_key`，否则可能造成来源、别名、点赞和审计记录无法对应。

## 检查和维护来源

允许的平台只有：

```text
CurseForge、Modrinth、Planet Minecraft、Minecraft Maps、MapVerse
```

编辑来源前先检查 URL 是否已被其他项目使用：

```sql
SELECT item_id, platform, url, normalized_url, external_id
FROM feedback_sources
WHERE normalized_url = '规范化后的完整 URL';
```

`normalized_url` 在全表中必须保持唯一。同一个来源 URL 不要分配给两个项目，也不要录入下载直链、搜索页或分类页。

普通编辑人员没有真正删除或合并项目的操作。发现重复项目时，先保留资料更完整的项目，再将另一项目设为 `hidden`，不要直接删除数据库行。

## 不要手动修改的内容

以下内容由 Worker 或数据库约束维护，普通编辑人员不要直接修改：

- `feedback_items.id`
- `feedback_items.canonical_key`
- `feedback_items.vote_count`
- `feedback_votes.voter_hash`
- `feedback_votes.active` 的历史记录
- `feedback_submissions` 审计记录
- 表结构、索引、主键、外键和迁移文件

不要清空业务表，不要重建数据库，不要修改数据库 ID，也不要对生产数据库执行测试种子。

## 前端卡片展示

卡片实现在 `src/layout/TranslationFeedbackLayout.vue`，沿用网站主题变量适配浅色和深色模式：

- 筛选区按“分类”和“类型”分行：分类采用等宽分段按钮，类型采用自然换行的描边标签；选中分类用主题色实底，选中类型用浅色底和描边。窄屏将标签移至控件上方，控件点击高度至少 44px，刷新按钮使用低强调描边样式，不添加分隔线。
- 提交表单的类型选项保留原生复选框多选行为，采用至少 44px 高的圆角标签；选中态使用主题色描边、浅色底和勾选标记，键盘焦点显示外轮廓，窄屏固定两列。
- 提交表单的来源链接将序号作为输入框左侧的内嵌前缀，与输入框共用外框和焦点状态；额外链接的删除按钮保留在右侧，增删后连续编号。
- 封面保持 16:9 裁切，左上角的排名标号统一使用深色半透明背景和白字，不按名次区分样式。
- 分类标签与类型标签区分层级；项目名称完整换行，不截断长名称。
- 状态以圆点徽章显示：候选为中性色、计划为蓝色、翻译中为警示色、已完成为绿色；来源链接与状态同区展示。
- 底部独立展示票数与投票按钮，已投票状态使用浅色描边，并通过 `aria-pressed` 表达选中状态。
- 窄屏单列，641px 起两列，901px 起三列；悬停浮起效果仅用于精确指针，减少动态效果设置会关闭位移动画。
- 底部分页使用无阴影的扁平按钮，点击区域至少 44×44px；当前页用主题色实底和 `aria-current="page"` 标识，首尾页禁用对应方向按钮。窄屏缩小间距并允许换行，键盘焦点使用清晰的外轮廓。

## 修改后的确认清单

- 项目仍然出现在正确的分类和类型筛选中。
- `status = 'hidden'` 的项目不再出现在公开列表。
- 封面 URL 可以在无登录状态下加载。
- `subtype` 等于 `subtypes` 的第一项。
- 来源 URL 的 `normalized_url` 没有重复。
- 页面刷新后点赞数量和项目状态仍然正确。
