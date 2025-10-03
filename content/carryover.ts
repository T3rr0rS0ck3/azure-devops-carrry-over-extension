// TypeScript interfaces for Azure DevOps objects
interface Sprint {
    id: string;
    name: string;
    path: string;
    attributes: {
        startDate: string;
        finishDate: string;
    };
}

interface WorkItem {
    id: number;
    fields: {
        'System.WorkItemType': string;
        'System.Title': string;
        'System.State': string;
        'System.IterationPath': string;
    };
}

interface TeamContext {
    projectId: string;
    project: string;
    teamId: string;
    team: string;
}

interface ProjectContext {
    id: string;
    name: string;
}

interface WebContext {
    project: ProjectContext;
    team: {
        id: string;
        name: string;
    };
}

// Extend the global VSS object with proper typing
declare const VSS: {
    init(options: { explicitNotifyLoaded: boolean }): void;
    ready(callback: () => void): void;
    notifyLoadSucceeded(): void;
    getService(serviceId: string): any;
    getWebContext(): WebContext;
    require(modules: string[], callback: (client: any) => void): void;
    ServiceIds: {
        WorkItemTracking: string;
        ExtensionData: string;
    };
};

(function (): void {
    let workItemTrackingClient: any;
    let projectContext: ProjectContext;
    let sprints: Sprint[] = [];
    let openWorkItems: WorkItem[] = [];

    VSS.init({ explicitNotifyLoaded: true });

    VSS.ready(function (): void {
        // Initialize VSS Services
        workItemTrackingClient = VSS.getService(VSS.ServiceIds.WorkItemTracking);
        projectContext = VSS.getWebContext().project;

        log("Extension loaded for project: " + projectContext.name);

        // Event Handlers
        const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
        const fromSprintSelect = document.getElementById("fromSprint") as HTMLSelectElement;
        const toSprintSelect = document.getElementById("toSprint") as HTMLSelectElement;

        if (carryOverBtn) carryOverBtn.addEventListener("click", carryOverItems);
        if (fromSprintSelect) fromSprintSelect.addEventListener("change", onFromSprintChange);
        if (toSprintSelect) toSprintSelect.addEventListener("change", updateCarryOverButton);

        // Load sprints
        loadSprints();

        VSS.notifyLoadSucceeded();
    });

    async function loadSprints(): Promise<void> {
        try {
            log("Loading sprints...");

            const webContext: WebContext = VSS.getWebContext();

            // Team Settings Service for iterations
            const teamContext: TeamContext = {
                projectId: webContext.project.id,
                project: webContext.project.name,
                teamId: webContext.team.id,
                team: webContext.team.name
            };

            // REST Client for Work Items
            VSS.require(["TFS/Work/RestClient"], function (WorkRestClient: any): void {
                const client = WorkRestClient.getClient();

                client.getTeamIterations(teamContext)
                    .then(function (iterations: Sprint[]): void {
                        sprints = iterations.sort((a: Sprint, b: Sprint) =>
                            new Date(b.attributes.startDate).getTime() - new Date(a.attributes.startDate).getTime()
                        );
                        populateSprintDropdowns();
                        log(`${sprints.length} sprints loaded`);
                    })
                    .catch(function (error: Error): void {
                        log("❌ Error loading sprints: " + error.message);
                        console.error(error);
                    });
            });

        } catch (error) {
            const err = error as Error;
            log("❌ Error loading sprints: " + err.message);
            console.error(error);
        }
    }

    function populateSprintDropdowns(): void {
        const fromSelect = document.getElementById("fromSprint") as HTMLSelectElement;
        const toSelect = document.getElementById("toSprint") as HTMLSelectElement;

        if (!fromSelect || !toSelect) return;

        // Clear dropdowns
        fromSelect.innerHTML = '<option value="">Select sprint...</option>';
        toSelect.innerHTML = '<option value="">Select sprint...</option>';

        // Add sprints
        sprints.forEach((sprint: Sprint) => {
            const option1 = new Option(
                `${sprint.name} (${formatDate(sprint.attributes.startDate)} - ${formatDate(sprint.attributes.finishDate)})`,
                sprint.id
            );
            const option2 = new Option(
                `${sprint.name} (${formatDate(sprint.attributes.startDate)} - ${formatDate(sprint.attributes.finishDate)})`,
                sprint.id
            );

            fromSelect.add(option1);
            toSelect.add(option2);
        });

        // Automatically preselect sprints based on current date
        if (sprints.length >= 2) {
            const currentDate = new Date();

            // Step 1: Find To Sprint - Sprint whose START date is closest to current date
            let toSprintIndex = -1;
            let smallestStartDateDiff = Infinity;

            sprints.forEach((sprint: Sprint, index: number) => {
                const startDate = new Date(sprint.attributes.startDate);
                const diff = Math.abs(startDate.getTime() - currentDate.getTime());
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

    function onFromSprintChange(): void {
        loadWorkItems();
        updateCarryOverButton();
    }

    async function loadWorkItems(sprintId?: string): Promise<void> {
        const fromSprintId = sprintId || (document.getElementById("fromSprint") as HTMLSelectElement)?.value;

        if (!fromSprintId) {
            return;
        }

        try {
            const selectedSprint = sprints.find((s: Sprint) => s.id === fromSprintId);
            if (!selectedSprint) {
                log("❌ Sprint not found");
                return;
            }

            log(`Loading work items from sprint "${selectedSprint.name}"...`);

            const wiql = `
        SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State]
        FROM WorkItems
        WHERE [System.IterationPath] = '${selectedSprint.path}'
        AND [System.State] <> 'Closed'
        AND [System.State] <> 'Done'
        AND [System.State] <> 'Removed'
        ORDER BY [System.WorkItemType], [System.Id]
      `;

            VSS.require(["TFS/WorkItemTracking/RestClient"], function (WitRestClient: any): void {
                const client = WitRestClient.getClient();

                const query = {
                    query: wiql
                };

                client.queryByWiql(query, projectContext.id)
                    .then(function (result: any): void {
                        if (result.workItems && result.workItems.length > 0) {
                            const ids = result.workItems.map((wi: any) => wi.id);

                            client.getWorkItems(ids, null, null, null, null, projectContext.id)
                                .then(function (workItems: WorkItem[]): void {
                                    openWorkItems = workItems;
                                    displayWorkItems(workItems);
                                    log(`✅ Found ${openWorkItems.length} open work items`);
                                })
                                .catch(function (error: Error): void {
                                    log("❌ Error loading work item details: " + error.message);
                                    console.error(error);
                                });
                        } else {
                            openWorkItems = [];
                            displayWorkItems([]);
                            log("ℹ️ No open work items found in selected sprint");
                        }
                    })
                    .catch(function (error: Error): void {
                        log("❌ Error with WIQL query: " + error.message);
                        console.error(error);
                    });
            });

        } catch (error) {
            const err = error as Error;
            log("❌ Error loading work items: " + err.message);
            console.error(error);
        }
    }

    function displayWorkItems(workItems: WorkItem[]): void {
        const container = document.getElementById("workItemsContainer") as HTMLDivElement;
        const list = document.getElementById("workItemsList") as HTMLDivElement;
        const count = document.getElementById("itemCount") as HTMLSpanElement;

        if (!container || !list || !count) return;

        list.innerHTML = "";

        workItems.forEach((item: WorkItem) => {
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

        count.textContent = workItems.length.toString();
        container.style.display = "block";

        // Update transfer count after items are displayed
        updateTransferCount();
    }

    async function carryOverItems(): Promise<void> {
        const fromSprintId = (document.getElementById("fromSprint") as HTMLSelectElement)?.value;
        const toSprintId = (document.getElementById("toSprint") as HTMLSelectElement)?.value;

        if (!fromSprintId || !toSprintId) {
            log("❌ Please select both sprints");
            return;
        }

        // Get only selected work items
        const selectedCheckboxes = document.querySelectorAll(".work-item-checkbox:checked") as NodeListOf<HTMLInputElement>;
        const selectedItemIds = Array.from(selectedCheckboxes).map((cb: HTMLInputElement) => parseInt(cb.dataset.itemId || "0"));
        const selectedWorkItems = openWorkItems.filter((item: WorkItem) => selectedItemIds.includes(item.id));

        if (selectedWorkItems.length === 0) {
            log("❌ No work items selected for transfer");
            return;
        }

        try {
            const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
            if (carryOverBtn) carryOverBtn.disabled = true;

            log(`Transferring ${selectedWorkItems.length} selected work items...`);

            const toSprintPath = sprints.find((s: Sprint) => s.id === toSprintId)?.path;
            if (!toSprintPath) {
                log("❌ Target sprint path not found");
                return;
            }

            let successCount = 0;

            VSS.require(["TFS/WorkItemTracking/RestClient"], function (WitRestClient: any): void {
                const client = WitRestClient.getClient();

                // Process work items sequentially
                let currentIndex = 0;

                function processNextWorkItem(): void {
                    if (currentIndex >= selectedWorkItems.length) {
                        // All work items processed
                        log(`🎉 Transfer completed: ${successCount}/${selectedWorkItems.length} work items successfully transferred`);

                        // Reload work items from the source sprint to show remaining items
                        const fromSprintId = (document.getElementById("fromSprint") as HTMLSelectElement)?.value;
                        if (fromSprintId) {
                            log("🔄 Reloading remaining work items...");
                            loadWorkItems(fromSprintId);
                        } else {
                            // Fallback: Reset UI if no sprint selected
                            openWorkItems = [];
                            const container = document.getElementById("workItemsContainer") as HTMLDivElement;
                            if (container) container.style.display = "none";
                        }

                        const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
                        if (carryOverBtn) carryOverBtn.disabled = false;
                        return;
                    }

                    const workItem = selectedWorkItems[currentIndex];

                    // Patch operation for Iteration Path
                    const patchDocument = [{
                        op: "replace",
                        path: "/fields/System.IterationPath",
                        value: toSprintPath
                    }];

                    client.updateWorkItem(patchDocument, workItem.id)
                        .then(function (): void {
                            successCount++;
                            log(`✅ Work Item #${workItem.id} transferred`);
                            currentIndex++;
                            processNextWorkItem();
                        })
                        .catch(function (error: Error): void {
                            log(`❌ Error with Work Item #${workItem.id}: ${error.message}`);
                            currentIndex++;
                            processNextWorkItem();
                        });
                }

                processNextWorkItem();
            });

        } catch (error) {
            const err = error as Error;
            log("❌ Error during transfer: " + err.message);
            const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
            if (carryOverBtn) carryOverBtn.disabled = false;
        }
    }

    function updateCarryOverButton(): void {
        const fromSprint = (document.getElementById("fromSprint") as HTMLSelectElement)?.value;
        const toSprint = (document.getElementById("toSprint") as HTMLSelectElement)?.value;
        const checkedBoxes = document.querySelectorAll(".work-item-checkbox:checked") as NodeListOf<HTMLInputElement>;
        const hasSelectedItems = checkedBoxes.length > 0;

        const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
        if (carryOverBtn) {
            carryOverBtn.disabled = !fromSprint || !toSprint || !hasSelectedItems;
        }
    }

    function formatDate(dateString: string): string {
        return new Date(dateString).toLocaleDateString('en-US');
    }

    function log(message: string): void {
        const logElement = document.getElementById("log") as HTMLPreElement;
        if (!logElement) return;

        const timestamp = new Date().toLocaleTimeString('en-US');
        logElement.textContent += `[${timestamp}] ${message}\n`;
        logElement.scrollTop = logElement.scrollHeight;
    }

    // Log toggle functionality
    const logToggleBtn = document.getElementById("logToggle") as HTMLButtonElement;
    const logContent = document.getElementById("logContent") as HTMLDivElement;
    const logToggleText = document.getElementById("logToggleText") as HTMLSpanElement;
    let logVisible = true;

    if (logToggleBtn && logContent && logToggleText) {
        logToggleBtn.addEventListener("click", function (): void {
            logVisible = !logVisible;

            if (logVisible) {
                logContent.classList.remove("collapsed");
                logToggleText.textContent = "Hide";
            } else {
                logContent.classList.add("collapsed");
                logToggleText.textContent = "Show";
            }
        });
    }

    // Checkbox functionality
    const selectAllBtn = document.getElementById("selectAllBtn") as HTMLButtonElement;
    const selectNoneBtn = document.getElementById("selectNoneBtn") as HTMLButtonElement;

    if (selectAllBtn) {
        selectAllBtn.addEventListener("click", function (): void {
            const checkboxes = document.querySelectorAll(".work-item-checkbox") as NodeListOf<HTMLInputElement>;
            checkboxes.forEach((checkbox: HTMLInputElement) => checkbox.checked = true);
            updateTransferCount();
        });
    }

    if (selectNoneBtn) {
        selectNoneBtn.addEventListener("click", function (): void {
            const checkboxes = document.querySelectorAll(".work-item-checkbox") as NodeListOf<HTMLInputElement>;
            checkboxes.forEach((checkbox: HTMLInputElement) => checkbox.checked = false);
            updateTransferCount();
        });
    }

    // Update count when individual checkboxes change
    document.addEventListener("change", function (event: Event): void {
        const target = event.target as HTMLInputElement;
        if (target && target.classList.contains("work-item-checkbox")) {
            updateTransferCount();
        }
    });

    function updateTransferCount(): void {
        const checkedBoxes = document.querySelectorAll(".work-item-checkbox:checked") as NodeListOf<HTMLInputElement>;
        const count = document.getElementById("itemCount") as HTMLSpanElement;
        if (count) {
            count.textContent = checkedBoxes.length.toString();
        }

        // Update button state
        const fromSprint = (document.getElementById("fromSprint") as HTMLSelectElement)?.value;
        const toSprint = (document.getElementById("toSprint") as HTMLSelectElement)?.value;
        const hasSelectedItems = checkedBoxes.length > 0;

        const carryOverBtn = document.getElementById("carryOverBtn") as HTMLButtonElement;
        if (carryOverBtn) {
            carryOverBtn.disabled = !fromSprint || !toSprint || !hasSelectedItems;
        }
    }
})();