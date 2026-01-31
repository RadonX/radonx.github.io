# github-blog-starter (Hugo + PaperMod + zh/en)

目标：先快速上线（GitHub Pages），同时保留后续“艺术化排版/杂志感”改造空间。

## 技术选型（已定）
- **Static generator**: Hugo
- **Theme**: PaperMod (Hugo Module 导入)
- **i18n**: Hugo 原生多语言（/zh/ 与 /en/）
- **Deploy**: GitHub Actions → `gh-pages` 分支

## 快速开始
1) 安装 Hugo（extended 版本更稳）
2) 在本仓库根目录：
   - `hugo server -D`
3) 发布：push 到 GitHub 后，Actions 会自动部署。

## 后续“艺术气质”升级的入口
- `assets/css/custom.css`：所有视觉调整都写这里（字体/排版/首页等），不 fork 主题。

## 文章结构
- 中文：`content/zh/posts/`
- 英文：`content/en/posts/`

同一篇双语文章使用相同 `translationKey` 互相关联。
