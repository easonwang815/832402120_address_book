| Item | Content |
| --- | --- |
| Course for This Assignment | Software Engineering (FZU–MU) |
| Team Name | 待定 |
| Assignment Requirements | [Extreme Programming](https://bbs.csdn.net/topics/620593436) |
| Objectives of This Assignment | 合作开发支持收藏、多种联系方式和 Excel 导入导出的通讯录 |
| Other References | 待补充 |

# 通讯录

软件工程极限编程作业，两人合作开发的网页通讯录。

## 计划功能

- 联系人新增、查看、编辑和删除
- 收藏联系人及查看收藏列表
- 为联系人添加多种联系方式
- Excel 导入和导出

## 技术方案

前端使用 HTML、CSS 和原生 JavaScript，后端使用 Python 3 + Flask 提供页面和 API。联系人写入 SQLite，Excel 导入导出由后端使用 openpyxl 处理。前后端分别放在 `frontend/` 和 `backend/`，共用本仓库和一个 Flask 服务。运行步骤随工程搭建补充。

## 项目成员

- 王以真（832402120）：主要开发和集成
- 徐紫东（832402124）：Excel 导入导出及测试

详细安排见 [项目计划](项目计划.md)，代码约定见 [代码规范](CODE_STANDARDS.md)。
