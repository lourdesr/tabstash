chrome.runtime.onInstalled.addListener(({ reason }) => {

  // Allows users to open the side panel by clicking on the action toolbar icon
  chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
  
  if (reason === 'install') {
    chrome.storage.local.set({
      pendingTabs: []
    });

    chrome.storage.local.set({ tabThreshold: 5 })
  }
});

const tabsToRemove = new Set();

chrome.tabs.onCreated.addListener(async (tab) => {
  const data = await chrome.storage.local.get("tabThreshold");
  const tabCountThreshold = data.tabThreshold;
  const tabs = await chrome.tabs.query({
    currentWindow: true
  });

  if (tabs.length > tabCountThreshold) {
      // dont add empty new tabs to the pending queue list
      if (tab.pendingUrl?.startsWith('chrome://')) {
        chrome.tabs.remove(tab.id);
        return;
      }
      tabsToRemove.add(tab.id);
  } else {
      // check if the new tab exists in the queue
      const data = await chrome.storage.local.get("pendingTabs");
      const tabs = data.pendingTabs || [];
      const pendingTabsUrl = tabs.map(pendingTab => pendingTab.url);

      if (pendingTabsUrl.includes(tab.pendingUrl)) {
          await removeFromQueue(tab);
      }
  }
});

/**
 * This is needed so that we can fetch the title of the page
 * to display meaningful information in the sidebar instead 
 * of just the URLs.
 * Trade-offs: Adds an extra second or two to close the tab
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabsToRemove.has(tabId)) {
    if (
      changeInfo.title || changeInfo.status === 'complete'
    ) {
      await addToQueue({
        tabId,
        title: tab.title || '',
        url: tab.url,
      });
      chrome.tabs.remove(tabId);
      tabsToRemove.delete(tabId);
    }
  }
});

async function addToQueue(newTab) {
  const {
    tabId,
    title,
    url,
  } = newTab;

  if (!url) return;

  const data = await chrome.storage.local.get("pendingTabs");
  const tabs = data.pendingTabs || [];
  const existingPendingTabsUrl = tabs.map(pendingTab => pendingTab.url);

  // enforce unique-only URLs when adding to pending tab queue
  if (!existingPendingTabsUrl.includes(url)) {
    tabs.push({ url, tabId, title, });
    await chrome.storage.local.set({ pendingTabs: tabs }); 
  }
}

async function removeFromQueue(newTab) {
    const data = await chrome.storage.local.get("pendingTabs");
    const tabs = data.pendingTabs || [];
    const newTabs = tabs.filter(tab => tab.url !== newTab.pendingUrl);
    await chrome.storage.local.set({ pendingTabs: newTabs });
}