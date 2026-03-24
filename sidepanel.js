const MAX_TAB_COUNT = 7;
const MIN_TAB_COUNT = 3;

const searchInput = document.getElementById('search');
const increaseBtn = document.getElementById('increase');
const decreaseBtn = document.getElementById('decrease');
const tabCountValue = document.getElementById('tab-count-value');
const queuedTabsCountValue = document.getElementById('queued-count-value');

function groupByHostname(tabs) {
  return tabs.reduce((groups, tab) => {
    try {
        const host = new URL(tab.url).hostname;
        groups[host] = groups[host] || [];
        groups[host].push(tab);
        return groups;        
    } catch (err) {
        return groups;
    }
  }, {});
}
async function initTabCount () {
    // get current tab count value
    const initTabCountValue = await chrome.storage.local.get('tabThreshold');
    tabCountValue.textContent = initTabCountValue.tabThreshold || 5;
    computeIncreaseBtnDisabled(parseInt(tabCountValue.textContent));
    computeDecreaseBtnDisabled(parseInt(tabCountValue.textContent));    
}

function computeIncreaseBtnDisabled(value) {
    value = parseInt(value);
    if (value <= MAX_TAB_COUNT) {
        increaseBtn.removeAttribute('disabled');
    }
    if (value >= MAX_TAB_COUNT) {
        increaseBtn.setAttribute('disabled', true);
    }
}

function computeDecreaseBtnDisabled(value) {
    value = parseInt(value);
    if (value > MIN_TAB_COUNT) {
        decreaseBtn.removeAttribute('disabled');
    }
    if (value <= MIN_TAB_COUNT) {
        decreaseBtn.setAttribute('disabled', true);
    }
}

increaseBtn.onclick = () => {
    if (parseInt(tabCountValue.textContent) < MAX_TAB_COUNT) {
        tabCountValue.textContent = (parseInt(tabCountValue.textContent)+1);
        chrome.storage.local.set({ tabThreshold: parseInt(tabCountValue.textContent) })
        computeIncreaseBtnDisabled(tabCountValue.textContent);
        computeDecreaseBtnDisabled(tabCountValue.textContent);
    }
};

decreaseBtn.onclick = () => {
    if (parseInt(tabCountValue.textContent) > MIN_TAB_COUNT) {
        tabCountValue.textContent = (parseInt(tabCountValue.textContent)-1);
        chrome.storage.local.set({ tabThreshold: parseInt(tabCountValue.textContent) })
        computeDecreaseBtnDisabled(tabCountValue.textContent);
        computeIncreaseBtnDisabled(tabCountValue.textContent);
    }
};

searchInput.addEventListener('input', async () => {
  const tabsQueued = await chrome.storage.local.get('pendingTabs');
  const query = searchInput.value.toLowerCase();
  const allTabs = tabsQueued.pendingTabs || [];
  const filtered = allTabs.filter(tab => tab.url.toLowerCase().includes(query));
  render(groupByHostname(filtered));
});

async function handleRemoveTab (removeTab) {
    const {
        tabId: rmTabId
    } = removeTab;
    const tabsQueued = await chrome.storage.local.get('pendingTabs');
    const tabsQueueRemoved = tabsQueued?.pendingTabs?.filter(tab => tab.tabId !== rmTabId);
    await chrome.storage.local.set({ pendingTabs: tabsQueueRemoved });
}

async function render(filteredList = null) {
    let queuedTabCountVal = 0;
    if (!filteredList) {
        const tabsQueued = await chrome.storage.local.get('pendingTabs');
        filteredList = groupByHostname(tabsQueued.pendingTabs || []);
    }
    const tabsMain = document.getElementById('tab-list');
    tabsMain.innerHTML = '';
    const hostnames = Object.keys(filteredList);

    for(const hostname of hostnames) {
        const section = document.createElement('section');
        const h6 = document.createElement('h6');
        h6.textContent = hostname;
        section.appendChild(h6);
        const hostNamElement = tabsMain.appendChild(section);
        const tabsInHost = filteredList[hostname];
        
        const ul = document.createElement('ul');
        const hostNameList = hostNamElement.appendChild(ul);

        for(const tab of tabsInHost) {
            const li = document.createElement('li');
            const openBtn = document.createElement('button');
            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'X';
            openBtn.textContent = '↗';
            openBtn.setAttribute('class', 'tab-action');
            closeBtn.setAttribute('class', 'tab-action');
            const a = document.createElement('a');
            let url;
            try {
                url = new URL(tab.url);
                if (url.protocol === 'https:' || url.protocol === 'http:') {
                    a.setAttribute('href', tab.url);
                }            
                a.textContent = tab.title;
                li.appendChild(a);
                li.appendChild(openBtn);
                li.appendChild(closeBtn);
                closeBtn.addEventListener('click', async () => {
                    // remove tab from pendingTabs in storage
                    handleRemoveTab(tab);
                });

                openBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: tab.url });
                });
                
                hostNameList.appendChild(li);
                ++queuedTabCountVal;                
            } catch (error) {
                continue;
            }
        }

    }
    queuedTabsCountValue.textContent = queuedTabCountVal;
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.pendingTabs) {
    render();
  }
});

initTabCount();
render();

