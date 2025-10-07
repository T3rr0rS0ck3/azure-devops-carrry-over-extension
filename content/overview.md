# Carry Over Open Work Items

This Azure DevOps extension automates the process of transferring all unfinished work items from the previous sprint to the current one.

## 🚀 Features

- Automatically carries over **all unfinished work items** from the last sprint.  
- Works directly from **Boards → Sprints → Backlog** via a toolbar button.  
- Supports **all work item types** (Tasks, Bugs, PBIs, User Stories).  
- Uses the **Azure DevOps REST API** for maximum reliability and compatibility.

## 🧭 Usage

1. Install the extension in your organization.  
2. Navigate to **Boards → Sprints → Backlog**.  
3. Click on **“Carry Over Open Items”** in the toolbar.  
4. The extension will automatically move all open work items from the previous sprint to the current one.

## ⚙️ Permissions

The extension requires the following scopes:
- `vso.work`  
- `vso.work_write`  

These are necessary to read and update work items.

## 🛠️ Planned Enhancements

- Automatic sprint detection option  
- Filtering by work item type  
- Notifications after successful carry-over  

---

**Publisher:** T3rr0rS0ck3  
**Version:** 1.0.12  
**Category:** Azure Boards  
**Repository:** [GitHub – azure-devops-carry-over-extension](https://github.com/T3rr0rS0ck3/azure-devops-carrry-over-extension)
