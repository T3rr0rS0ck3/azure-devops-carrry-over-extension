(function () {
  let workItemTrackingClient;
  let projectContext;
  let sprints = [];
  let openWorkItems = [];

  VSS.init({ explicitNotifyLoaded: true });

  VSS.ready(function () {
    // Initialize VSS Services
    workItemTrackingClient = VSS.getService(VSS.ServiceIds.WorkItemTracking);
    projectContext = VSS.getWebContext().project;

    log("Extension loaded for project: " + projectContext.name);

    // Event Handlers
    document.getElementById("carryOverBtn").addEventListener("click", carryOverItems);
    document.getElementById("fromSprint").addEventListener("change", onFromSprintChange);
    document.getElementById("toSprint").addEventListener("change", updateCarryOverButton);

    // Load sprints
    loadSprints();

    VSS.notifyLoadSucceeded();
  }); async function loadSprints() {
    try {
      log("Loading sprints...");

      // Use VSS Work Rest Client
      const workRestClient = VSS.getService(VSS.ServiceIds.ExtensionData);
      const webContext = VSS.getWebContext();

      // Team Settings Service for iterations
      const teamContext = {
        projectId: webContext.project.id,
        project: webContext.project.name,
        teamId: webContext.team.id,
        team: webContext.team.name
      };

      // REST Client for Work Items
      VSS.require(["TFS/Work/RestClient"], function (WorkRestClient) {
        const client = WorkRestClient.getClient();

        client.getTeamIterations(teamContext).then(function (iterations) {
          sprints = iterations.sort((a, b) => new Date(b.attributes.startDate) - new Date(a.attributes.startDate));
          populateSprintDropdowns();
          log(`${sprints.length} sprints loaded`);
        }).catch(function (error) {
          log("❌ Error loading sprints: " + error.message);
          console.error(error);
        });
      });

    } catch (error) {
      log("❌ Error loading sprints: " + error.message);
      console.error(error);
    }
  }

  function populateSprintDropdowns() {
    const fromSelect = document.getElementById("fromSprint");
    const toSelect = document.getElementById("toSprint");

    // Clear dropdowns
    fromSelect.innerHTML = '<option value="">Select sprint...</option>';
    toSelect.innerHTML = '<option value="">Select sprint...</option>';

    // Add sprints
    sprints.forEach(sprint => {
      const option1 = new Option(`${sprint.name} (${formatDate(sprint.attributes.startDate)} - ${formatDate(sprint.attributes.finishDate)})`, sprint.id);
      const option2 = new Option(`${sprint.name} (${formatDate(sprint.attributes.startDate)} - ${formatDate(sprint.attributes.finishDate)})`, sprint.id);

      fromSelect.add(option1);
      toSelect.add(option2);
    });

    // Automatically preselect sprints based on current date
    if (sprints.length >= 2) {
      const currentDate = new Date();

      // Step 1: Find To Sprint - Sprint whose START date is closest to current date
      let toSprintIndex = -1;
      let smallestStartDateDiff = Infinity;

      sprints.forEach((sprint, index) => {
        const startDate = new Date(sprint.attributes.startDate);
        const diff = Math.abs(startDate - currentDate);
        if (diff < smallestStartDateDiff) {
          smallestStartDateDiff = diff;
          toSprintIndex = index;
        }
      });

      // Step 2: Find From Sprint - Previous sprint in chronological order
      let fromSprintIndex = -1;

      if (toSprintIndex !== -1) {
        // Sprints are sorted by startDate descending, so we need to find the chronologically previous sprint
        const toSprint = sprints[toSprintIndex];
        const toStartDate = new Date(toSprint.attributes.startDate);

        // Find sprint that ends before the To sprint starts
        for (let i = 0; i < sprints.length; i++) {
          if (i === toSprintIndex) continue; // Skip the To sprint itself

          const sprint = sprints[i];
          const sprintStartDate = new Date(sprint.attributes.startDate);

          // Look for sprint that starts before the To sprint
          if (sprintStartDate < toStartDate) {
            if (fromSprintIndex === -1 || sprintStartDate > new Date(sprints[fromSprintIndex].attributes.startDate)) {
              fromSprintIndex = i;
            }
          }
        }
      }

      // Set selections
      if (toSprintIndex !== -1) {
        const toSprint = sprints[toSprintIndex];
        toSelect.value = toSprint.id;
        log(`🎯 Auto-selected To Sprint: ${toSprint.name} (start date closest to today)`);
      }

      if (fromSprintIndex !== -1) {
        const fromSprint = sprints[fromSprintIndex];
        fromSelect.value = fromSprint.id;
        log(`🎯 Auto-selected From Sprint: ${fromSprint.name} (previous sprint)`);
        onFromSprintChange(); // Automatically load work items
      }
    } else if (sprints.length === 1) {
      // If only one sprint, show a message
      log("ℹ️ Only one sprint available - please add more sprints for transfer functionality");
    }
  }

  function onFromSprintChange() {
    loadWorkItems();
    updateCarryOverButton();
  }

  async function loadWorkItems() {
    const fromSprintId = document.getElementById("fromSprint").value;
    if (!fromSprintId) {
      // Reset sprint selection
      openWorkItems = [];
      document.getElementById("workItemsContainer").style.display = "none";
      updateCarryOverButton();
      return;
    }

    try {
      const selectedSprint = sprints.find(s => s.id === fromSprintId);
      if (!selectedSprint) {
        log("❌ Sprint not found");
        return;
      }

      log(`Loading work items from sprint "${selectedSprint.name}"...`);

      // WIQL Query for open work items in sprint
      const wiqlQuery = {
        query: `
          SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State]
          FROM WorkItems
          WHERE [System.IterationPath] = '${selectedSprint.path}'
          AND [System.State] <> 'Done'
          AND [System.State] <> 'Closed'
          AND [System.State] <> 'Removed'
          ORDER BY [System.Id]
        `
      };

      VSS.require(["TFS/WorkItemTracking/RestClient"], function (WitRestClient) {
        const client = WitRestClient.getClient();

        client.queryByWiql(wiqlQuery, projectContext.id).then(function (queryResult) {
          if (queryResult.workItems && queryResult.workItems.length > 0) {
            // Load work item details
            const workItemIds = queryResult.workItems.map(wi => wi.id);

            client.getWorkItems(workItemIds, ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.IterationPath']).then(function (workItemDetails) {
              openWorkItems = workItemDetails;
              displayWorkItems(openWorkItems);
              log(`✅ Found ${openWorkItems.length} open work items`);
              updateCarryOverButton();
            }).catch(function (error) {
              log("❌ Error loading work item details: " + error.message);
              console.error(error);
            });

          } else {
            openWorkItems = [];
            document.getElementById("workItemsContainer").style.display = "none";
            log("ℹ️ No open work items found in selected sprint");
          }
        }).catch(function (error) {
          log("❌ Error with WIQL query: " + error.message);
          console.error(error);
        });
      });

    } catch (error) {
      log("❌ Error loading work items: " + error.message);
      console.error(error);
    }
  }

  function displayWorkItems(workItems) {
    const container = document.getElementById("workItemsContainer");
    const list = document.getElementById("workItemsList");
    const count = document.getElementById("itemCount");

    list.innerHTML = "";

    workItems.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "work-item";
      div.innerHTML = `
        <input type="checkbox" class="work-item-checkbox" id="workitem-${item.id}" data-item-id="${item.id}" checked>
        <span class="work-item-id">#${item.id}</span>
        <span class="work-item-type">[${item.fields['System.WorkItemType']}]</span>
        <span class="work-item-title">${item.fields['System.Title']}</span>
        <span class="work-item-state">(${item.fields['System.State']})</span>
      `;
      list.appendChild(div);
    });

    count.textContent = workItems.length;
    container.style.display = "block";

    // Update transfer count after items are displayed
    updateTransferCount();
  }

  async function carryOverItems() {
    const fromSprintId = document.getElementById("fromSprint").value;
    const toSprintId = document.getElementById("toSprint").value;

    if (!fromSprintId || !toSprintId) {
      log("❌ Please select both sprints");
      return;
    }

    if (openWorkItems.length === 0) {
      log("❌ No work items available for transfer");
      return;
    }

    // Get only selected work items
    const selectedCheckboxes = document.querySelectorAll(".work-item-checkbox:checked");
    const selectedItemIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.itemId));
    const selectedWorkItems = openWorkItems.filter(item => selectedItemIds.includes(item.id));

    if (selectedWorkItems.length === 0) {
      log("❌ No work items selected for transfer");
      return;
    }

    try {
      document.getElementById("carryOverBtn").disabled = true;
      log(`Transferring ${selectedWorkItems.length} selected work items...`);

      const toSprintPath = sprints.find(s => s.id === toSprintId).path;
      let successCount = 0;

      VSS.require(["TFS/WorkItemTracking/RestClient"], function (WitRestClient) {
        const client = WitRestClient.getClient();

        // Process work items sequentially
        let currentIndex = 0;

        function processNextWorkItem() {
          if (currentIndex >= selectedWorkItems.length) {
            // All work items processed
            log(`🎉 Transfer completed: ${successCount}/${selectedWorkItems.length} work items successfully transferred`);

            // Reload work items from the source sprint to show remaining items
            const fromSprintId = document.getElementById("fromSprint").value;
            if (fromSprintId) {
              log("🔄 Reloading remaining work items...");
              loadWorkItems(fromSprintId);
            } else {
              // Fallback: Reset UI if no sprint selected
              openWorkItems = [];
              document.getElementById("workItemsContainer").style.display = "none";
            }

            document.getElementById("carryOverBtn").disabled = false;
            return;
          }

          const workItem = selectedWorkItems[currentIndex];

          // Patch operation for Iteration Path
          const patchDocument = [{
            op: "replace",
            path: "/fields/System.IterationPath",
            value: toSprintPath
          }];

          client.updateWorkItem(patchDocument, workItem.id).then(function () {
            successCount++;
            log(`✅ Work Item #${workItem.id} transferred`);
            currentIndex++;
            processNextWorkItem();
          }).catch(function (error) {
            log(`❌ Error with Work Item #${workItem.id}: ${error.message}`);
            currentIndex++;
            processNextWorkItem();
          });
        }

        processNextWorkItem();
      });

    } catch (error) {
      log("❌ Error during transfer: " + error.message);
      document.getElementById("carryOverBtn").disabled = false;
    }
  }

  function updateCarryOverButton() {
    const fromSprint = document.getElementById("fromSprint").value;
    const toSprint = document.getElementById("toSprint").value;
    const checkedBoxes = document.querySelectorAll(".work-item-checkbox:checked");
    const hasSelectedItems = checkedBoxes.length > 0;

    document.getElementById("carryOverBtn").disabled = !fromSprint || !toSprint || !hasSelectedItems;
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US');
  }

  function log(message) {
    const logElement = document.getElementById("log");
    const timestamp = new Date().toLocaleTimeString('en-US');
    logElement.textContent += `[${timestamp}] ${message}\n`;
    logElement.scrollTop = logElement.scrollHeight;
  }

  // Log toggle functionality
  const logToggleBtn = document.getElementById("logToggle");
  const logContent = document.getElementById("logContent");
  const logToggleText = document.getElementById("logToggleText");
  let logVisible = true;

  logToggleBtn.addEventListener("click", function () {
    logVisible = !logVisible;

    if (logVisible) {
      logContent.classList.remove("collapsed");
      logToggleText.textContent = "Hide";
    } else {
      logContent.classList.add("collapsed");
      logToggleText.textContent = "Show";
    }
  });

  // Checkbox functionality
  const selectAllBtn = document.getElementById("selectAllBtn");
  const selectNoneBtn = document.getElementById("selectNoneBtn");

  selectAllBtn.addEventListener("click", function () {
    const checkboxes = document.querySelectorAll(".work-item-checkbox");
    checkboxes.forEach(checkbox => checkbox.checked = true);
    updateTransferCount();
  });

  selectNoneBtn.addEventListener("click", function () {
    const checkboxes = document.querySelectorAll(".work-item-checkbox");
    checkboxes.forEach(checkbox => checkbox.checked = false);
    updateTransferCount();
  });

  // Update count when individual checkboxes change
  document.addEventListener("change", function (event) {
    if (event.target.classList.contains("work-item-checkbox")) {
      updateTransferCount();
    }
  });

  function updateTransferCount() {
    const checkedBoxes = document.querySelectorAll(".work-item-checkbox:checked");
    const count = document.getElementById("itemCount");
    count.textContent = checkedBoxes.length;

    // Update button state
    const fromSprint = document.getElementById("fromSprint").value;
    const toSprint = document.getElementById("toSprint").value;
    const hasSelectedItems = checkedBoxes.length > 0;

    document.getElementById("carryOverBtn").disabled = !fromSprint || !toSprint || !hasSelectedItems;
  }
})();