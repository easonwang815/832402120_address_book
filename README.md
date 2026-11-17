| Item | Content |
| --- | --- |
| Course for This Assignment | Software Engineering (FZU–MU) |
| Team Name | 待定 |
| Assignment Requirements | [Extreme Programming](https://bbs.csdn.net/topics/620593436) |
| Objectives of This Assignment | 合作开发支持收藏、多种联系方式和 Excel 导入导出的通讯录 |
| Other References | 待补充 |

# 通讯录

软件工程极限编程作业，两人合作开发的网页通讯录。

## 在线访问

[访问通讯录](https://eason.pythonanywhere.com/)

## 计划功能

- 联系人新增、查看、编辑和删除
- 收藏联系人及查看收藏列表
- 为联系人添加多种联系方式
- Excel 导入和导出

## 技术方案

前端使用 HTML、CSS 和原生 JavaScript，后端使用 Python 3 + Flask 提供页面和 API。联系人写入 SQLite，Excel 导入导出由后端使用 openpyxl 处理。前后端分别放在 `frontend/` 和 `backend/`，共用本仓库和一个 Flask 服务。运行步骤随工程搭建补充。

## 运行

需要 Python 3。首次运行时在项目根目录执行：

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python backend/app.py
```

在浏览器中访问 http://127.0.0.1:5051。以后运行时激活虚拟环境，再执行 `python backend/app.py`。按 Ctrl+C 停止服务。联系人保存在本地 `instance/contacts.sqlite`。

当前版本支持联系人增删改查、收藏、多种联系方式、头像、生日、备注和标签，以及搜索排序、统计、复制、主题切换和 Excel 导入导出。最近添加指最近 7 天创建的联系人，主题偏好保存在当前浏览器中。

## Excel 导入导出

点击顶部 **Export Excel** 下载 `.xlsx` 文件，文件包含全部联系人，每人一行。姓名、收藏、生日、备注、创建时间、标签和各类联系方式分别放在不同列；同一类型的多条联系方式分别占列。头像以缩略图或 Emoji 显示，原始头像数据保存在隐藏列，以便重新导入；表格不包含分组。请勿将含私人信息的表格公开分享。

点击 **Import Excel** 选择本应用导出的 `.xlsx` 文件，也可以先导出空表作为模板填写。表头需要保留；电话等可能以零开头的内容请在 Excel 中设置为文本。`Favorite` 填 `Yes` 或 `No`；`Tags` 使用 JSON 数组，例如 `["Friends", "Work"]`。请保留隐藏的 `Avatar` 列以恢复头像；`Other` 联系方式需同时填写类型和值。

导入会追加联系人，不会覆盖已有数据，重复导入可能产生重复联系人。空白行忽略，缺少姓名的行跳过并显示数量；其他格式错误会取消整次导入。仅支持 `.xlsx`，文件最大 10 MB、最多 5000 行，不接受公式。Excel 单元格有长度限制，超长头像和备注会自动分段；其他单个字段过长时导出会提示错误。

测试：`python -m unittest discover -s tests -v`。已部署的服务器需要更新代码、安装 `requirements.txt` 中的依赖并重新加载应用，才会出现这些功能。

## 项目成员

- 王以真（832402120）：主要开发和集成
- 徐紫东（832402124）：Excel 导入导出及测试

详细安排见 [项目计划](项目计划.md)，代码约定见 [代码规范](CODE_STANDARDS.md)。
