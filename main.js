const { Plugin, PluginSettingTab, Setting, Notice, debounce, MarkdownView } = require('obsidian');

const DEFAULT_SETTINGS = {
  triggerMode: 'click',
  hoverOpenDelay: 120,
  hoverCloseDelay: 180,
  animationDuration: 220,
  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  badgeType: 'emoji',
  badgeText: '引用',
  badgeEmoji: '💬',
  badgePosition: 'outside-left',
  badgeOffsetX: 12,
  badgeOffsetY: 2,
  badgeBg: 'var(--interactive-accent)',
  badgeTextColor: 'var(--text-on-accent)',
  badgeBorderColor: 'transparent',
  badgeFontSize: 12,
  badgeOpacity: 0.95,
  badgeRadius: 999,
  badgePaddingX: 8,
  badgePaddingY: 2,
  autoCollapseOthers: false,
};

const ROOT_CLASS = 'qtf-enhanced';
const HOST_CLASS = 'qtf-host';
const TARGET_CLASS = 'qtf-target';
const BADGE_CLASS = 'qtf-badge';
const OPEN_CLASS = 'is-qtf-open';
const HOVER_CLASS = 'is-qtf-hover';

class QuoteTriggerFoldPlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.renderAllDebounced = debounce(() => this.decorateAllOpenMarkdownViews(), 120, true);

    this.registerEvent(this.app.workspace.on('layout-change', () => this.renderAllDebounced()));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.renderAllDebounced()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.renderAllDebounced()));
    this.registerEvent(this.app.workspace.on('css-change', () => this.renderAllDebounced()));

    this.registerDomEvent(document, 'click', (evt) => this.handleDocumentClick(evt), true);
    this.registerMarkdownPostProcessor((el) => {
      window.requestAnimationFrame(() => this.decorateRenderedScope(el));
    });

    this.addCommand({
      id: 'refresh-quote-triggers',
      name: '刷新引用触发器',
      callback: () => {
        this.decorateAllOpenMarkdownViews(true);
        new Notice('引用触发器已刷新');
      },
    });

    this.addSettingTab(new QuoteTriggerFoldSettingTab(this.app, this));
    this.injectStyle();
    this.decorateAllOpenMarkdownViews(true);
  }

  onunload() {
    this.removeAllDecorations();
    this.styleEl?.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.badgePosition === 'left') this.settings.badgePosition = 'outside-left';
    if (this.settings.badgePosition === 'outside-right' || this.settings.badgePosition === 'inside-right') {
      this.settings.badgePosition = 'outside-right';
    }
  }

  async saveSettings(refresh = true) {
    await this.saveData(this.settings);
    this.injectStyle();
    if (refresh) this.decorateAllOpenMarkdownViews(true);
  }

  getBadgeLabel() {
    return this.settings.badgeType === 'emoji'
      ? (this.settings.badgeEmoji || DEFAULT_SETTINGS.badgeEmoji)
      : (this.settings.badgeText || DEFAULT_SETTINGS.badgeText);
  }

  injectStyle() {
    this.styleEl?.remove();
    const s = document.createElement('style');
    s.id = 'unordered-list-quote-fold-style';

    const x = Number(this.settings.badgeOffsetX) || 0;
    const y = Number(this.settings.badgeOffsetY) || 0;
    const sideRule = this.settings.badgePosition === 'outside-left'
      ? `left: calc(-1 * (${x}px + var(--qtf-badge-width, 40px))); right: auto;`
      : `right: calc(-1 * (${x}px + var(--qtf-badge-width, 40px))); left: auto;`;

    s.textContent = `
    .markdown-reading-view.${ROOT_CLASS} {
      --qtf-duration: ${this.settings.animationDuration}ms;
      --qtf-easing: ${this.settings.easing};
      --qtf-badge-bg: ${this.settings.badgeBg};
      --qtf-badge-text: ${this.settings.badgeTextColor};
      --qtf-badge-border: ${this.settings.badgeBorderColor};
      --qtf-badge-font-size: ${this.settings.badgeFontSize}px;
      --qtf-badge-opacity: ${this.settings.badgeOpacity};
      --qtf-badge-radius: ${this.settings.badgeRadius}px;
      --qtf-badge-padding-x: ${this.settings.badgePaddingX}px;
      --qtf-badge-padding-y: ${this.settings.badgePaddingY}px;
    }

    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS} {
      position: relative;
      overflow: visible;
    }

    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS} > button.${BADGE_CLASS} {
      position: absolute;
      ${sideRule}
      top: ${y}px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 1.65em;
      padding: var(--qtf-badge-padding-y) var(--qtf-badge-padding-x);
      border-radius: var(--qtf-badge-radius);
      border: 1px solid var(--qtf-badge-border);
      background: var(--qtf-badge-bg);
      color: var(--qtf-badge-text);
      font-size: var(--qtf-badge-font-size);
      line-height: 1.2;
      font-weight: 700;
      white-space: nowrap;
      opacity: var(--qtf-badge-opacity);
      cursor: pointer;
      box-shadow: 0 6px 18px rgb(0 0 0 / 0.12);
      transition: opacity 160ms ease, transform 160ms ease, box-shadow 160ms ease;
    }

    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS} > button.${BADGE_CLASS}:hover,
    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS}.${HOVER_CLASS} > button.${BADGE_CLASS},
    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS}.${OPEN_CLASS} > button.${BADGE_CLASS} {
      opacity: 1;
      transform: translateY(-1px);
      box-shadow: 0 10px 24px rgb(0 0 0 / 0.16);
    }

    .markdown-reading-view.${ROOT_CLASS} ul.${TARGET_CLASS} {
      max-height: 0;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      overflow: hidden;
      transform: translateY(-6px);
      margin-top: 0 !important;
      border-left: none !important;
      box-shadow: none !important;
      background-image: none !important;
      transition:
        max-height var(--qtf-duration) var(--qtf-easing),
        opacity calc(var(--qtf-duration) * 0.72) ease,
        transform calc(var(--qtf-duration) * 0.72) ease,
        visibility 0s linear var(--qtf-duration);
    }

    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS}.${OPEN_CLASS} > ul.${TARGET_CLASS},
    .markdown-reading-view.${ROOT_CLASS} li.${HOST_CLASS}.${HOVER_CLASS} > ul.${TARGET_CLASS} {
      max-height: var(--qtf-target-max-height, 720px);
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      overflow: visible;
      transform: translateY(0);
      transition:
        max-height var(--qtf-duration) var(--qtf-easing),
        opacity calc(var(--qtf-duration) * 0.72) ease,
        transform calc(var(--qtf-duration) * 0.72) ease,
        visibility 0s linear 0s;
    }

    .qtf-settings {
      padding: 8px 0 24px;
    }

    .qtf-settings-shell {
      width: min(100%, 760px);
      margin: 0 auto;
      padding: 0 20px;
      box-sizing: border-box;
    }

    .qtf-settings-head {
      margin: 2px 0 12px;
      text-align: center;
    }

    .qtf-settings-head h2 {
      margin: 0;
      font-size: 1.15em;
      line-height: 1.3;
      font-weight: 700;
    }

    .qtf-settings-head p {
      margin: 6px auto 0;
      max-width: 46em;
      color: var(--text-muted);
      font-size: 0.9em;
      line-height: 1.55;
    }

    .qtf-tabs {
      display: flex;
      justify-content: center;
      gap: 4px;
      margin: 0 0 14px 0;
      padding: 0 0 8px 0;
      border-bottom: 1px solid var(--background-modifier-border);
    }

    .qtf-tab {
      appearance: none;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: var(--text-muted);
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: color 140ms ease, background-color 140ms ease;
    }

    .qtf-tab:hover {
      color: var(--text-normal);
      background: var(--background-modifier-hover);
    }

    .qtf-tab.is-active {
      color: var(--text-normal);
      background: var(--background-secondary);
    }

    .qtf-panel[hidden] { display: none !important; }
    .qtf-section-head { margin: 0 0 4px 0; }
    .qtf-section-head h3 { margin: 0; font-size: 0.98em; font-weight: 700; }
    .qtf-section-head p { margin: 4px 0 0; color: var(--text-muted); font-size: 0.88em; line-height: 1.5; }
    .qtf-section-body { margin-top: 8px; }
    .qtf-section-body .setting-item { border: 0; padding: 10px 0; }
    .qtf-section-body .setting-item:not(:last-child) { border-bottom: 1px solid var(--background-modifier-border); }
    .qtf-settings .setting-item-name { font-weight: 600; }
    .qtf-settings .setting-item-description { color: var(--text-muted); line-height: 1.5; }
    .qtf-settings .setting-item-control { gap: 8px; }
    .qtf-settings .setting-item-control input[type="number"],
    .qtf-settings .setting-item-control input[type="text"],
    .qtf-settings .setting-item-control select { min-width: 116px; }
    .qtf-color-row { display: inline-flex; align-items: center; gap: 8px; }
    .qtf-color-picker {
      width: 34px; height: 26px; padding: 0; border: 1px solid var(--background-modifier-border);
      border-radius: 6px; background: transparent; cursor: pointer;
    }
    `;

    document.head.appendChild(s);
    this.styleEl = s;
  }

  removeAllDecorations() {
    const roots = document.querySelectorAll(`.markdown-reading-view.${ROOT_CLASS}`);
    roots.forEach((root) => {
      root.classList.remove(ROOT_CLASS);
      root.querySelectorAll(`li.${HOST_CLASS}`).forEach((li) => {
        li.classList.remove(HOST_CLASS, OPEN_CLASS, HOVER_CLASS);
        li.querySelector(`:scope > button.${BADGE_CLASS}`)?.remove();
        const target = li.querySelector(`:scope > ul.${TARGET_CLASS}`);
        if (target) {
          target.classList.remove(TARGET_CLASS);
          target.style.removeProperty('--qtf-target-max-height');
        }
      });
    });
  }

  decorateAllOpenMarkdownViews(force = false) {
    this.app.workspace.getLeavesOfType('markdown').forEach((leaf) => {
      const view = leaf.view;
      if (!(view instanceof MarkdownView)) return;
      const container = view.containerEl?.querySelector('.markdown-reading-view');
      if (container) this.decorateRenderedScope(container, force);
    });
  }

  decorateRenderedScope(scopeEl, force = false) {
    const root = scopeEl.closest?.('.markdown-reading-view') || scopeEl;
    if (!(root instanceof HTMLElement)) return;
    root.classList.add(ROOT_CLASS);
    root.querySelectorAll('li').forEach((li) => this.decorateListItem(li, force));
  }

  decorateListItem(li, force = false) {
    if (!(li instanceof HTMLLIElement)) return;
    const targetUl = this.findDirectTargetUl(li);
    const existingBadge = li.querySelector(`:scope > button.${BADGE_CLASS}`);

    if (!targetUl) {
      li.classList.remove(HOST_CLASS, OPEN_CLASS, HOVER_CLASS);
      existingBadge?.remove();
      li.querySelector(`:scope > ul.${TARGET_CLASS}`)?.classList.remove(TARGET_CLASS);
      return;
    }

    li.classList.add(HOST_CLASS);
    targetUl.classList.add(TARGET_CLASS);
    this.syncTargetHeight(targetUl);

    let badge = existingBadge;
    if (!badge || force) {
      existingBadge?.remove();
      badge = this.createBadge();
      li.appendChild(badge);
    }

    badge.textContent = this.getBadgeLabel();
    badge.setAttribute('aria-label', '切换引用内容');
    badge.title = this.settings.triggerMode === 'click' ? '点击展开/收起引用' : '移到此处展开引用';
    this.bindHostEvents(li, badge, targetUl);
  }

  findDirectTargetUl(li) {
    const directUls = Array.from(li.children).filter((child) => child.tagName === 'UL');
    return directUls.find((ul) => {
      const immediateQuote = ul.querySelector(':scope > li blockquote');
      const deeperQuote = ul.querySelector(':scope > li > ul blockquote');
      return !!immediateQuote && !deeperQuote;
    }) || null;
  }

  createBadge() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = BADGE_CLASS;
    button.setAttribute('data-qtf-bound', 'false');
    button.setAttribute('tabindex', '0');
    return button;
  }

  bindHostEvents(li, badge, targetUl) {
    if (badge.dataset.qtfBound === 'true') return;
    badge.dataset.qtfBound = 'true';

    let openTimer = null;
    let closeTimer = null;

    const clearTimers = () => {
      if (openTimer) window.clearTimeout(openTimer);
      if (closeTimer) window.clearTimeout(closeTimer);
      openTimer = null;
      closeTimer = null;
    };

    const open = () => {
      clearTimers();
      if (this.settings.autoCollapseOthers) this.closeSiblingHosts(li);
      li.classList.add(OPEN_CLASS);
      li.classList.remove(HOVER_CLASS);
      this.syncTargetHeight(targetUl);
    };

    const close = () => {
      clearTimers();
      li.classList.remove(OPEN_CLASS, HOVER_CLASS);
    };

    const hoverOpen = () => {
      clearTimers();
      openTimer = window.setTimeout(() => {
        li.classList.add(HOVER_CLASS);
        this.syncTargetHeight(targetUl);
      }, this.settings.hoverOpenDelay);
    };

    const hoverClose = () => {
      clearTimers();
      closeTimer = window.setTimeout(() => li.classList.remove(HOVER_CLASS), this.settings.hoverCloseDelay);
    };

    badge.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (this.settings.triggerMode !== 'click') return;
      li.classList.contains(OPEN_CLASS) ? close() : open();
    });

    badge.addEventListener('mouseenter', () => {
      if (this.settings.triggerMode === 'hover') hoverOpen();
    });
    badge.addEventListener('mouseleave', () => {
      if (this.settings.triggerMode === 'hover') hoverClose();
    });
    targetUl.addEventListener('mouseenter', () => {
      if (this.settings.triggerMode === 'hover') {
        clearTimers();
        li.classList.add(HOVER_CLASS);
      }
    });
    targetUl.addEventListener('mouseleave', () => {
      if (this.settings.triggerMode === 'hover') hoverClose();
    });

    badge.addEventListener('keydown', (evt) => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return;
      evt.preventDefault();
      evt.stopPropagation();
      if (this.settings.triggerMode === 'click') {
        li.classList.contains(OPEN_CLASS) ? close() : open();
      } else {
        li.classList.add(HOVER_CLASS);
        this.syncTargetHeight(targetUl);
      }
    });
  }

  handleDocumentClick(evt) {
    if (this.settings.triggerMode !== 'click') return;
    const target = evt.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(`button.${BADGE_CLASS}`)) return;

    document.querySelectorAll(`li.${HOST_CLASS}.${OPEN_CLASS}`).forEach((li) => {
      if (!li.contains(target)) li.classList.remove(OPEN_CLASS, HOVER_CLASS);
    });
  }

  closeSiblingHosts(currentLi) {
    document.querySelectorAll(`li.${HOST_CLASS}.${OPEN_CLASS}`).forEach((li) => {
      if (li !== currentLi) li.classList.remove(OPEN_CLASS, HOVER_CLASS);
    });
  }

  syncTargetHeight(targetUl) {
    if (!(targetUl instanceof HTMLElement)) return;
    targetUl.style.setProperty('--qtf-target-max-height', `${Math.max(targetUl.scrollHeight + 40, 120)}px`);
  }
}

class QuoteTriggerFoldSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.activeTabKey = 'interaction';
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('qtf-settings');

    const shell = containerEl.createDiv({ cls: 'qtf-settings-shell' });
    const head = shell.createDiv({ cls: 'qtf-settings-head' });
    head.createEl('h2', { text: '💬 Unordered List Quote Fold' });
    head.createEl('p', { text: '仅处理 > 标准引用。设置页保持原生、简约、多标签页。' });

    const tabs = shell.createDiv({ cls: 'qtf-tabs' });
    const panels = shell.createDiv({ cls: 'qtf-panels' });

    const panelDefs = [
      { key: 'interaction', label: '⚙️ 交互', title: '⚙️ 交互设置', desc: '控制触发方式、延迟与折叠策略。' },
      { key: 'badge', label: '🏷️ 标志', title: '🏷️ 标志设置', desc: '设置文字或表情、左右外侧位置、偏移与颜色。' },
      { key: 'reveal', label: '📂 展开', title: '📂 展开设置', desc: '控制动画与页面刷新。' },
    ];

    const panelMap = new Map();
    const tabMap = new Map();

    const activateTab = (key) => {
      this.activeTabKey = key;
      for (const [k, btn] of tabMap.entries()) btn.classList.toggle('is-active', k === key);
      for (const [k, panel] of panelMap.entries()) panel.hidden = k !== key;
    };

    for (const def of panelDefs) {
      const btn = tabs.createEl('button', { cls: 'qtf-tab', text: def.label });
      btn.type = 'button';
      btn.addEventListener('click', () => activateTab(def.key));
      tabMap.set(def.key, btn);

      const panel = panels.createDiv({ cls: 'qtf-panel' });
      panelMap.set(def.key, panel);
      const body = this.createSection(panel, def.title, def.desc);
      def.body = body;
    }

    activateTab(panelDefs.some((d) => d.key === this.activeTabKey) ? this.activeTabKey : panelDefs[0].key);

    const interactionCard = panelDefs.find(d => d.key === 'interaction').body;
    const badgeCard = panelDefs.find(d => d.key === 'badge').body;
    const revealCard = panelDefs.find(d => d.key === 'reveal').body;

    new Setting(interactionCard)
      .setName('触发模式')
      .setDesc('🖱️ 点击标志展开/收起，或仅在移动到标志处时展开。')
      .addDropdown((dd) => dd
        .addOption('click', '点击')
        .addOption('hover', '悬浮')
        .setValue(this.plugin.settings.triggerMode)
        .onChange(async (value) => {
          this.plugin.settings.triggerMode = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    this.addNumericSetting(interactionCard, '悬浮展开延迟', '⏱️ 仅在悬浮模式下生效，单位：毫秒。', 'hoverOpenDelay', { min: 0, max: 3000 });
    this.addNumericSetting(interactionCard, '悬浮收起延迟', '⏱️ 仅在悬浮模式下生效，单位：毫秒。', 'hoverCloseDelay', { min: 0, max: 3000 });

    new Setting(interactionCard)
      .setName('自动关闭其他已展开项')
      .setDesc('🧹 开启后，新的引用展开时会关闭同页其他已展开项。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoCollapseOthers)
        .onChange(async (value) => {
          this.plugin.settings.autoCollapseOthers = value;
          await this.plugin.saveSettings();
        }));

    new Setting(interactionCard)
      .setName('刷新当前页面')
      .setDesc('🔄 页面样式或内容已变化但触发器未更新时，手动执行一次。')
      .addButton((btn) => btn
        .setButtonText('立即刷新')
        .setCta()
        .onClick(() => {
          this.plugin.decorateAllOpenMarkdownViews(true);
          new Notice('已刷新当前引用触发器');
        }));

    new Setting(badgeCard)
      .setName('标志类型')
      .setDesc('🙂 可选文本标志或表情标志。')
      .addDropdown((dd) => dd
        .addOption('text', '文字')
        .addOption('emoji', '表情')
        .setValue(this.plugin.settings.badgeType)
        .onChange(async (value) => {
          this.plugin.settings.badgeType = value;
          await this.plugin.saveSettings();
          this.display();
        }));

    this.addCommittedTextSetting(badgeCard, '文字标志', '📝 当标志类型为文字时显示。', this.plugin.settings.badgeText, async (value) => {
      this.plugin.settings.badgeText = value || DEFAULT_SETTINGS.badgeText;
      await this.plugin.saveSettings();
      this.display();
    }, '引用');

    this.addCommittedTextSetting(badgeCard, '表情标志', '✨ 当标志类型为表情时显示。', this.plugin.settings.badgeEmoji, async (value) => {
      this.plugin.settings.badgeEmoji = value || DEFAULT_SETTINGS.badgeEmoji;
      await this.plugin.saveSettings();
      this.display();
    }, '💬');

    new Setting(badgeCard)
      .setName('标志位置')
      .setDesc('↔️ 只保留左外侧与右外侧两种布局。')
      .addDropdown((dd) => dd
        .addOption('outside-left', '左外侧')
        .addOption('outside-right', '右外侧')
        .setValue(this.plugin.settings.badgePosition)
        .onChange(async (value) => {
          this.plugin.settings.badgePosition = value;
          await this.plugin.saveSettings();
        }));

    this.addNumericSetting(badgeCard, '横向偏移', '📏 单位：像素。正值会进一步向左右外侧偏移。', 'badgeOffsetX', { refresh: true });
    this.addNumericSetting(badgeCard, '纵向偏移', '📏 单位：像素。用于微调与列表首行的对齐。', 'badgeOffsetY', { refresh: true });
    this.addNumericSetting(badgeCard, '标志字号', '🔠 单位：像素。', 'badgeFontSize', { refresh: true });
    this.addNumericSetting(badgeCard, '圆角半径', '◼️ 单位：像素。999 可做成胶囊。', 'badgeRadius', { refresh: true });
    this.addNumericSetting(badgeCard, '水平内边距', '↔️ 单位：像素。', 'badgePaddingX', { refresh: true });
    this.addNumericSetting(badgeCard, '垂直内边距', '↕️ 单位：像素。', 'badgePaddingY', { refresh: true });

    this.addColorSetting(badgeCard, '背景色', '🎨 使用取色器选择标志背景色。', 'badgeBg', '#7c6cff');
    this.addColorSetting(badgeCard, '文字颜色', '🎨 使用取色器选择标志文字颜色。', 'badgeTextColor', '#ffffff');
    this.addColorSetting(badgeCard, '边框颜色', '🎨 使用取色器选择标志边框颜色。', 'badgeBorderColor', '#7c6cff');

    const badgeOpacitySetting = new Setting(badgeCard).setName('透明度').setDesc('🫥 0 到 1。');
    this.addCommittedNumberControl(badgeOpacitySetting, this.plugin.settings.badgeOpacity, async (num) => {
      this.plugin.settings.badgeOpacity = sanitizeFloat(num, DEFAULT_SETTINGS.badgeOpacity, 0, 1);
      await this.plugin.saveSettings();
      this.display();
    }, { min: 0, max: 1, step: 0.01 });

    this.addNumericSetting(revealCard, '展开动画时长', '🎞️ 单位：毫秒。', 'animationDuration');

    this.addCommittedTextSetting(revealCard, '动画缓动', '🧭 可填 ease、linear 或 cubic-bezier(...)。', this.plugin.settings.easing, async (value) => {
      this.plugin.settings.easing = value || DEFAULT_SETTINGS.easing;
      await this.plugin.saveSettings();
    }, 'cubic-bezier(0.2, 0.8, 0.2, 1)');

    new Setting(revealCard)
      .setName('恢复默认设置')
      .setDesc('♻️ 将当前插件设置恢复为默认值。')
      .addButton((btn) => btn
        .setButtonText('恢复默认')
        .onClick(async () => {
          this.plugin.settings = Object.assign({}, DEFAULT_SETTINGS);
          await this.plugin.saveSettings();
          this.display();
          new Notice('已恢复默认设置');
        }));
  }

  createSection(parent, title, desc) {
    const section = parent.createDiv({ cls: 'qtf-section' });
    const head = section.createDiv({ cls: 'qtf-section-head' });
    head.createEl('h3', { text: title });
    head.createEl('p', { text: desc });
    return section.createDiv({ cls: 'qtf-section-body' });
  }

  addNumericSetting(container, name, desc, key, options = {}) {
    const { min = 0, max = 9999, step = 1, refresh = false } = options;
    const setting = new Setting(container).setName(name).setDesc(desc);
    this.addCommittedNumberControl(setting, this.plugin.settings[key], async (num) => {
      this.plugin.settings[key] = sanitizeNumber(num, DEFAULT_SETTINGS[key], min, max);
      await this.plugin.saveSettings();
      if (refresh) this.display();
    }, { min, max, step });
  }

  addCommittedNumberControl(setting, initialValue, onCommit, { min = 0, max = 9999, step = 1 } = {}) {
    let draft = String(initialValue);
    let saving = false;
    setting.addText((text) => {
      text.setValue(draft);
      text.inputEl.type = 'number';
      text.inputEl.min = String(min);
      text.inputEl.max = String(max);
      text.inputEl.step = String(step);
      text.onChange((value) => {
        draft = value;
      });

      const commit = async () => {
        if (saving) return;
        saving = true;
        const raw = Number(draft);
        const next = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : Number(initialValue);
        draft = String(next);
        text.setValue(draft);
        await onCommit(next);
        saving = false;
      };

      text.inputEl.addEventListener('blur', () => { void commit(); });
      text.inputEl.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          void commit();
        }
      });
    });
  }

  addColorSetting(container, name, desc, key, fallback = '#7c6cff') {
    const setting = new Setting(container).setName(name).setDesc(desc);
    const current = normalizeColorValue(this.plugin.settings[key], fallback);
    const row = setting.controlEl.createDiv({ cls: 'qtf-color-row' });
    const picker = row.createEl('input', { cls: 'qtf-color-picker', attr: { type: 'color', value: current, 'aria-label': `${name}取色器` } });
    const text = row.createEl('input', { attr: { type: 'text', value: current, 'aria-label': `${name}颜色值` } });
    text.placeholder = '#rrggbb 或 var(--token)';
    text.style.minWidth = '140px';

    const commit = async (value) => {
      const normalized = normalizeColorValue(value, fallback);
      if (normalized.startsWith('#')) picker.value = normalized;
      text.value = normalized;
      this.plugin.settings[key] = normalized;
      await this.plugin.saveSettings();
    };

    picker.addEventListener('input', () => {
      text.value = picker.value;
    });
    picker.addEventListener('change', () => { void commit(picker.value); });
    text.addEventListener('blur', () => { void commit(text.value); });
    text.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        void commit(text.value);
      }
    });
  }

  addCommittedTextSetting(container, name, desc, initialValue, onCommit, placeholder = '') {
    const setting = new Setting(container).setName(name).setDesc(desc);
    let draft = String(initialValue ?? '');
    let saving = false;
    setting.addText((text) => {
      if (placeholder) text.setPlaceholder(placeholder);
      text.setValue(draft);
      text.onChange((value) => {
        draft = value;
      });

      const commit = async () => {
        if (saving) return;
        saving = true;
        await onCommit(draft);
        saving = false;
      };

      text.inputEl.addEventListener('blur', () => { void commit(); });
      text.inputEl.addEventListener('keydown', (evt) => {
        if (evt.key === 'Enter') {
          evt.preventDefault();
          void commit();
        }
      });
    });
    return setting;
  }
}

function sanitizeNumber(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function sanitizeFloat(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function normalizeColorValue(value, fallback = '#7c6cff') {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  if (/^var\(--[\w-]+\)$/.test(v)) return v;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
    return v.length === 4 ? '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3] : v.toLowerCase();
  }
  return fallback;
}

module.exports = QuoteTriggerFoldPlugin;
