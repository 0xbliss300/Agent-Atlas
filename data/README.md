# Agent Atlas 本地数据目录

本目录由 Agent Atlas 的本地文件持久化层管理。真实运行数据会按类别写入以下子目录：

- `meta/`：格式版本与迁移状态；
- `projects/`：项目主体；
- `research-notes/`：正式研究笔记；
- `drafts/`：研究笔记草稿；
- `history/`：研究笔记版本历史；
- `events/`：项目变更事件；
- `templates/`：用户自定义模板；
- `organization/`：集合等组织信息；
- `settings/`：显示与排序设置。

除本说明文件外，`data/` 下的真实内容默认被 Git 忽略。请勿手动修改应用正在使用的数据文件；备份或迁移前先关闭本地开发/预览服务。
