import { buildingThumb, iconUrl, portraitUrl } from '../art/registry';
import type { IconId } from '../art/effects';
import { BUILD_ORDER, BUILDINGS, defenseAt, housingAt, levelCost, limitAt, workerSlots, type BuildingDef } from '../data/buildings';
import { ERAS, eraForHq } from '../data/eras';
import { HEROES, HERO_BY_ID, bonusText, heroStats, heroUpgradeCost } from '../data/heroes';
import { QUESTS } from '../data/quests';
import { RES_IDS, RESOURCES, type ResBag, type ResId } from '../data/resources';
import { dayAt, dayPhase, isNight, seasonAt, SEASONS, type SeasonDef } from '../data/seasons';
import { game, type OfflineReport } from '../game';
import * as eco from '../sim/economy';
import { fmtTime, type WorldScene } from '../scenes/WorldScene';

const root = document.getElementById('ui')!;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function fmt(n: number): string {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

const ico = (id: IconId) => `<img src="${iconUrl(id)}" alt="">`;

function costChips(cost: ResBag, check = true): string {
  return Object.entries(cost)
    .map(([k, v]) => {
      const bad = check && game.state.res[k as ResId] < (v as number);
      return `<span class="chip ${bad ? 'bad' : ''}">${ico(k as ResId)}${fmt(v as number)}</span>`;
    })
    .join('');
}

function rewardChips(r: ResBag & { legend?: number }): string {
  return Object.entries(r)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="chip">${ico(k as IconId)}${fmt(v as number)}</span>`)
    .join('');
}

/** Sets innerHTML only when it actually changes, so buttons do not flicker. */
function setHtml(e: HTMLElement, html: string) {
  if ((e as any)._html !== html) {
    (e as any)._html = html;
    e.innerHTML = html;
  }
}

export class UI {
  private scene!: WorldScene;
  private top = el('div', 'topbar');
  private chief = el('div', 'chief');
  private resources = el('div', 'resources');
  private clock = el('div', 'clock');
  private quest = el('div', 'quest');
  private actions = el('div', 'actions');
  private zoom = el('div', 'zoom');
  private panel: HTMLDivElement | null = null;
  private drawer: HTMLDivElement | null = null;
  private placebar: HTMLDivElement | null = null;
  private modal: HTMLDivElement | null = null;
  private toasts = el('div', 'toasts');
  private raidbar = el('div', 'raidbar');
  private selected: number | null = null;
  private drawerTab = 'all';
  private questCollapsed = false;
  private resEls = new Map<ResId, { root: HTMLDivElement; num: HTMLElement; rate: HTMLElement; cap: HTMLElement }>();
  private placing: { mode: string; type: string; ok: boolean } | null = null;

  constructor() {
    root.append(this.top, this.quest, this.actions, this.zoom, this.toasts);
    this.top.append(this.chief, this.resources, this.clock);
    const gear = el('div', 'iconbtn', '⚙');
    gear.onclick = () => this.openSettings();
    this.top.append(gear);
    this.raidbar.style.display = 'none';
    root.append(this.raidbar);

    for (const id of RES_IDS) {
      const r = el('div', 'res');
      r.style.setProperty('--c', RESOURCES[id].color);
      r.innerHTML = `${ico(id)}<span class="num">0</span><span class="rate"></span><span class="cap"><i></i></span>`;
      r.title = RESOURCES[id].name;
      this.resources.append(r);
      this.resEls.set(id, { root: r, num: r.querySelector('.num')!, rate: r.querySelector('.rate')!, cap: r.querySelector('.cap i')! });
    }

    this.actions.innerHTML = `
      <div class="bigbtn legends" data-act="legends">${ico('legend')}Legends<span class="badge" style="display:none"></span></div>
      <div class="bigbtn" data-act="build">${ico('hammer')}Build</div>`;
    this.actions.onclick = (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (act === 'build') this.openDrawer();
      if (act === 'legends') this.openLegends();
    };
    this.zoom.innerHTML = `<div class="iconbtn" data-z="1">+</div><div class="iconbtn" data-z="-1">−</div>`;
    this.zoom.onclick = (e) => {
      const z = (e.target as HTMLElement).closest('[data-z]')?.getAttribute('data-z');
      if (z) game.bus.emit('ui:zoom', +z);
    };
    this.quest.onclick = () => {
      if (game.questDone()) game.claimQuest();
      else this.questCollapsed = !this.questCollapsed;
      this.renderQuest();
    };
    this.clock.onclick = () => this.openSeasonInfo();

    game.bus.on('changed', () => this.render());
    game.bus.on('select', (uid: number | null) => this.select(uid));
    game.bus.on('toast', (t: string, k: 'info' | 'warn' | 'good') => this.toast(t, k));
    game.bus.on('mode', (m: string, type?: string) => this.onMode(m, type));
    game.bus.on('ghost', (ok: boolean) => {
      if (this.placing) {
        this.placing.ok = ok;
        this.renderPlacebar();
      }
    });
    game.bus.on('raidWarning', (n: number) => this.banner('Raiders approach!', `Raid ${n} begins at nightfall — get ready`, 'danger'));
    game.bus.on('raidStart', (n: number) => {
      const comp = n % 5 === 0 ? 'A terrible foe leads them…' : 'Defend the village until dawn';
      this.banner(`Raid ${n}`, comp, 'danger');
    });
    game.bus.on('boss', (name: string) => this.banner(name, 'A legendary beast attacks!', 'danger'));
    game.bus.on('raidResult', (r: any) => this.raidResult(r));
    game.bus.on('season', (s: SeasonDef) => this.banner(s.name, s.desc, 'good'));
    game.bus.on('questClaimed', () => this.toast('Quest complete!', 'good'));
    game.bus.on('hearthUp', (lvl: number) => {
      const era = ERAS.find((e) => e.hqLevel === lvl);
      if (era) this.eraModal(era.id);
    });
    game.bus.on('offline', (r: OfflineReport) => this.offlineModal(r));
  }

  attach(scene: WorldScene) {
    this.scene = scene;
    this.render();
    if (game.offline) this.offlineModal(game.offline);
    else if (game.state.stats.arrivals === 0 && game.state.quest === 0 && game.state.time < 60) this.introModal();
  }

  // ------------------------------------------------------------ HUD

  render() {
    if (!this.scene) return;
    const s = game.state;
    const era = eraForHq(eco.hqLevel(s));
    const cap = eco.capacity(s);
    const rates = eco.netRates(s);
    setHtml(
      this.chief,
      `<div class="hq-badge">${eco.hqLevel(s)}</div>
       <div><div class="era">${era.name}</div>
       <div class="sub"><span>${ico('pop')} ${s.pop}/${eco.housing(s)}</span><span>${ico('legend')} ${s.legend}</span></div></div>`,
    );
    for (const id of RES_IDS) {
      const r = this.resEls.get(id)!;
      const visible = RESOURCES[id].era <= era.id || s.res[id] > 0;
      r.root.style.display = visible ? '' : 'none';
      if (!visible) continue;
      r.num.textContent = fmt(s.res[id]);
      const rate = rates[id];
      r.rate.textContent = Math.abs(rate) < 0.05 ? '' : `${rate > 0 ? '+' : ''}${rate.toFixed(rate > -10 && rate < 10 ? 1 : 0)}/m`;
      r.rate.className = `rate ${rate < 0 ? 'neg' : 'pos'}`;
      r.cap.style.width = `${Math.min(100, (s.res[id] / cap) * 100)}%`;
      r.root.classList.toggle('full', s.res[id] >= cap);
      r.root.classList.toggle('empty', (id === 'food' || id === 'water') && s.res[id] <= 0);
    }
    // Clock.
    const ph = dayPhase(s.time);
    const season = seasonAt(s.time);
    const eta = this.scene.raidEta();
    const raidText = game.raidActive ? 'Raid in progress!' : eta < 60 ? `Raid in ${fmtTime(eta)}` : `Next raid ${fmtTime(eta)}`;
    setHtml(
      this.clock,
      `<div class="dial"><div class="hand" style="transform: rotate(${ph * 360 + 180}deg)"></div><div class="sun" style="background:${isNight(s.time) ? '#e8ecff' : '#ffd34a'}"></div></div>
       <div><div class="t1">Day ${dayAt(s.time)} · ${season.name}</div><div class="t2 ${game.raidActive || eta < 60 ? 'danger' : ''}">${raidText}</div></div>`,
    );
    this.renderQuest();
    // Legends badge: count summonable heroes.
    const ready = HEROES.filter((h) => eco.canSummon(s, h.id).ok).length;
    const badge = this.actions.querySelector('.legends .badge') as HTMLElement;
    badge.style.display = ready ? '' : 'none';
    badge.textContent = String(ready);
    if (this.panel) this.renderPanel();
    if (this.drawer) this.renderDrawer();
    if (this.modal?.dataset.kind === 'legends') this.renderLegends();
    if (this.modal?.dataset.kind === 'hero') this.renderHero(this.modal.dataset.id!);
    this.raidbar.style.display = game.raidActive ? '' : 'none';
    if (game.raidActive) this.raidbar.textContent = `⚔ Raid ${s.raids.count} — hold until dawn`;
  }

  private renderQuest() {
    const q = game.currentQuest();
    if (!q) {
      this.quest.style.display = 'none';
      return;
    }
    const [cur, target] = q.progress(game.state);
    const done = cur >= target;
    this.quest.classList.toggle('done', done);
    this.quest.classList.toggle('collapsed', this.questCollapsed && !done);
    setHtml(
      this.quest,
      `<div class="qbody"><div class="qlabel">${done ? 'Tap to claim' : `Quest ${game.state.quest + 1}/${QUESTS.length}`}</div>
       <div class="qtitle">${q.title}</div>
       <div class="qbar"><i style="width:${Math.min(100, (cur / target) * 100)}%"></i></div>
       <div class="qhint">${Math.floor(Math.min(cur, target))}/${target} · ${q.hint}</div>
       <div class="qreward">${rewardChips(q.reward)}</div></div>`,
    );
  }

  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info') {
    const t = el('div', `toast ${kind}`, text);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild!.remove();
    setTimeout(() => t.remove(), 2700);
  }

  banner(title: string, sub: string, kind: 'danger' | 'good' = 'good') {
    const b = el('div', `big-banner ${kind}`, `<div class="ribbon ${kind}"><h1>${title}</h1><p>${sub}</p></div>`);
    root.append(b);
    setTimeout(() => b.remove(), 3500);
  }

  // ------------------------------------------------------------ selection

  private select(uid: number | null) {
    this.selected = uid;
    if (uid === null) {
      this.panel?.remove();
      this.panel = null;
      return;
    }
    this.closeDrawer();
    if (!this.panel) {
      this.panel = el('div', 'panel');
      this.panel.onclick = (e) => this.onPanelClick(e);
      root.append(this.panel);
    }
    this.renderPanel();
  }

  private renderPanel() {
    const s = game.state;
    const b = s.buildings.find((x) => x.uid === this.selected);
    if (!b || !this.panel) {
      this.select(null);
      return;
    }
    const d = BUILDINGS[b.type];
    const lvl = Math.max(1, b.level);
    const stats: string[] = [];
    const rate = eco.buildingRate(s, b);
    if (d.produces) {
      const per = rate ? rate.perMin : 0;
      stats.push(`<span class="stat">${ico(d.produces.res)} ${per.toFixed(1)}/min</span>`);
      if (d.consumes) stats.push(`<span class="stat">${ico(d.consumes.res)} −${(d.consumes.rate * b.workers).toFixed(1)}/min</span>`);
    }
    if (d.housing) stats.push(`<span class="stat">${ico('pop')} Houses ${housingAt(d, lvl)}</span>`);
    if (d.storage) stats.push(`<span class="stat">${ico('food')} Storage +${d.storage * lvl}</span>`);
    if (b.type === 'hearth') {
      stats.push(`<span class="stat">${ico('food')} Storage cap ${fmt(eco.capacity(s))}</span>`);
      stats.push(`<span class="stat">${ico('hammer')} Builders ${eco.builders(s)}</span>`);
      stats.push(`<span class="stat">🗺 Territory ${eco.territoryRadius(s) * 2 + 2} tiles</span>`);
    }
    const def = defenseAt(d, lvl);
    if (def) stats.push(`<span class="stat">${ico('sword')} ${def.damage.toFixed(0)} dmg · range ${def.range.toFixed(1)}</span>`);
    if (d.guards) stats.push(`<span class="stat">${ico('sword')} ${b.workers} guards</span>`);
    stats.push(`<span class="stat">❤ ${Math.ceil(b.hp)}/${eco.maxHp(s, b)}</span>`);

    let workers = '';
    if (d.workers && b.level > 0) {
      const slots = workerSlots(d, b.level);
      let html = '';
      for (let i = 0; i < slots; i++) html += `<span class="slot ${i < b.workers ? 'on' : ''}">${i < b.workers ? ico('pop') : ''}</span>`;
      workers = `<div class="workers">${d.guards ? 'Guards' : 'Workers'}
        <button class="btn red small" data-act="w-" ${b.workers <= 0 ? 'disabled' : ''}>−</button>
        <span class="slots">${html}</span>
        <button class="btn small" data-act="w+" ${b.workers >= slots || eco.idle(s) <= 0 ? 'disabled' : ''}>+</button>
        <span style="font-size:11px;opacity:.75">${eco.idle(s)} idle</span></div>`;
    }

    let actions = '';
    if (b.construct) {
      const pct = (1 - (b.construct.end - s.time) / b.construct.total) * 100;
      const cost = eco.rushCost(s, b);
      actions = `<div style="font-weight:900;font-size:12px">${b.level === 0 ? 'Building' : `Upgrading to ${b.construct.toLevel}`} · ${fmtTime(b.construct.end - s.time)}</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <button class="btn gold" data-act="rush" ${s.legend < cost ? 'disabled' : ''}>Finish ${ico('legend')}${cost}</button>`;
    } else if (b.level < d.maxLevel) {
      const check = eco.upgradeCheck(s, b);
      const next = levelCost(d, b.level + 1);
      const hint = !check.ok && check.reason !== 'Not enough resources' ? `<small>${check.reason}</small>` : '';
      actions = `<button class="btn ${b.type === 'hearth' ? 'gold' : ''}" data-act="upgrade" ${check.ok ? '' : 'disabled'}>
        <span>Upgrade to ${b.level + 1}${hint}<div class="stats" style="margin-top:3px">${costChips(next)}</div></span></button>`;
    } else actions = `<div class="stat">Max level</div>`;
    const extra =
      b.type === 'griot' && b.level > 0
        ? `<button class="btn blue" data-act="legends">${ico('legend')}Legends</button>`
        : b.type === 'hearth'
          ? `<button class="btn blue" data-act="season">Seasons</button>`
          : '';
    const move = b.type !== 'hearth' ? `<button class="btn wood" data-act="move">Move</button>` : '';
    setHtml(
      this.panel,
      `<div class="phead"><h2>${d.name}</h2><span class="lvl">${b.level === 0 ? 'Under construction' : `Level ${b.level}`}</span><button class="close" data-act="close">✕</button></div>
       <div class="pbody"><div class="pinfo"><div class="desc">${d.desc}</div><div class="stats">${stats.join('')}</div>${workers}</div>
       <div class="pact">${actions}<div style="display:flex;gap:6px">${move}${extra}</div></div></div>`,
    );
  }

  private onPanelClick(e: MouseEvent) {
    const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
    const uid = this.selected;
    if (!act || uid === null) return;
    const b = game.state.buildings.find((x) => x.uid === uid);
    if (!b) return;
    switch (act) {
      case 'close':
        game.bus.emit('ui:deselect');
        break;
      case 'w+':
        game.setWorkers(uid, b.workers + 1);
        break;
      case 'w-':
        game.setWorkers(uid, b.workers - 1);
        break;
      case 'upgrade':
        game.upgrade(uid);
        break;
      case 'rush':
        game.rush(uid);
        break;
      case 'move':
        game.bus.emit('ui:move', uid);
        break;
      case 'legends':
        this.openLegends();
        break;
      case 'season':
        this.openSeasonInfo();
        break;
    }
  }

  // ------------------------------------------------------------ build drawer

  private openDrawer() {
    if (this.drawer) return this.closeDrawer();
    game.bus.emit('ui:deselect');
    game.bus.emit('ui:cancel');
    this.drawer = el('div', 'drawer');
    this.drawer.onclick = (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest('[data-tab]')?.getAttribute('data-tab');
      if (tab) {
        this.drawerTab = tab;
        this.renderDrawer();
        return;
      }
      if (t.closest('[data-act=close]')) return this.closeDrawer();
      const type = t.closest('[data-build]')?.getAttribute('data-build');
      if (type) {
        const can = eco.canBuildType(game.state, type);
        if (!can.ok) return this.toast(can.reason, 'warn');
        this.closeDrawer();
        game.bus.emit('ui:place', type);
      }
    };
    root.append(this.drawer);
    this.actions.style.display = 'none';
    this.renderDrawer();
  }

  private closeDrawer() {
    this.drawer?.remove();
    this.drawer = null;
    if (!this.placing) this.actions.style.display = '';
  }

  private renderDrawer() {
    if (!this.drawer) return;
    const s = game.state;
    const hq = eco.hqLevel(s);
    const cats: Record<string, (d: BuildingDef) => boolean> = {
      all: () => true,
      economy: (d) => ['production', 'storage', 'housing'].includes(d.category),
      defense: (d) => d.category === 'defense',
      special: (d) => d.category === 'special',
    };
    const cards = BUILD_ORDER.map((id) => BUILDINGS[id])
      .filter(cats[this.drawerTab])
      .filter((d) => d.hqRequired <= hq + 3)
      .map((d) => {
        const count = eco.countOf(s, d.id);
        const limit = limitAt(d, hq);
        const locked = hq < d.hqRequired;
        const maxed = !locked && count >= limit;
        const lock = locked ? `<div class="lock">🔒 Hearth level ${d.hqRequired}</div>` : maxed ? `<div class="lock">Built ${count}/${limit}<br><small>Upgrade the Hearth</small></div>` : '';
        return `<div class="card ${locked || maxed ? 'locked' : ''}" data-build="${d.id}">
          <div class="thumb"><img src="${buildingThumb(this.scene, d.id)}" alt=""></div>${lock}
          ${locked ? '' : `<span class="count">${count}/${limit}</span>`}
          <div class="cname">${d.name}</div><div class="ccost">${costChips(levelCost(d, 1))}</div></div>`;
      })
      .join('');
    const tabs = ['all', 'economy', 'defense', 'special'].map((t) => `<div class="tab ${t === this.drawerTab ? 'on' : ''}" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}</div>`).join('');
    setHtml(
      this.drawer,
      `<div class="dhead"><h2>Build</h2><div class="tabs">${tabs}</div>
       <span class="chip">${ico('hammer')}${eco.busyBuilders(s)}/${eco.builders(s)} builders</span>
       <button class="close" data-act="close">✕</button></div><div class="cards">${cards}</div>`,
    );
  }

  // ------------------------------------------------------------ placement

  private onMode(mode: string, type?: string) {
    this.placebar?.remove();
    this.placebar = null;
    if (mode === 'idle') {
      this.placing = null;
      this.actions.style.display = '';
      return;
    }
    this.placing = { mode, type: type!, ok: true };
    this.actions.style.display = 'none';
    this.placebar = el('div', 'placebar');
    this.placebar.onclick = (e) => {
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (act === 'ok') game.bus.emit('ui:confirm');
      if (act === 'no') game.bus.emit('ui:cancel');
    };
    root.append(this.placebar);
    this.renderPlacebar();
  }

  private renderPlacebar() {
    if (!this.placebar || !this.placing) return;
    const d = BUILDINGS[this.placing.type];
    const cost = this.placing.mode === 'place' ? `<div class="stats" style="justify-content:center;margin-top:2px">${costChips(levelCost(d, 1))}</div>` : '';
    setHtml(
      this.placebar,
      `<button class="btn red" data-act="no">✕</button>
       <div class="phint">${this.placing.mode === 'move' ? 'Move' : 'Place'} ${d.name}<br><small style="opacity:.8">Drag or tap to position</small>${cost}</div>
       <button class="btn" data-act="ok" ${this.placing.ok ? '' : 'disabled'}>✓</button>`,
    );
  }

  // ------------------------------------------------------------ modals

  private openModal(kind: string, title: string, body: string, foot = '', onClick?: (act: string, e: MouseEvent) => void) {
    this.closeModal();
    const bg = el('div', 'modal-bg');
    bg.dataset.kind = kind;
    bg.innerHTML = `<div class="modal"><div class="mhead"><h2>${title}</h2><button class="close" data-act="close">✕</button></div>
      <div class="mbody">${body}</div>${foot ? `<div class="mfoot">${foot}</div>` : ''}</div>`;
    bg.onclick = (e) => {
      if (e.target === bg) return this.closeModal();
      const act = (e.target as HTMLElement).closest('[data-act]')?.getAttribute('data-act');
      if (act === 'close') return this.closeModal();
      if (act && onClick) onClick(act, e);
    };
    root.append(bg);
    this.modal = bg;
    return bg;
  }

  private closeModal() {
    this.modal?.remove();
    this.modal = null;
  }

  private introModal() {
    this.openModal(
      'intro',
      'Sankofa',
      `<div class="story">
        <p><em>Sankofa</em> — an Akan word: <em>"go back and fetch it."</em> Learn from the past to build the future.</p>
        <p>The drought scattered your people. You are alone on the savanna with a small fire, a few acacias, and the long night ahead.</p>
        <p>Gather wood, raise huts, and others will find your fire. Grow from a camp to a village, from a village to a kingdom. Call on the legends of Africa's history — and survive the raiders and beasts that come with the dark.</p>
      </div>`,
      `<button class="btn gold" data-act="start" style="font-size:20px;padding:10px 30px">Light the fire</button>`,
      (act) => {
        if (act === 'start') this.closeModal();
      },
    );
  }

  private offlineModal(r: OfflineReport) {
    const gained = Object.entries(r.gained).filter(([, v]) => (v as number) > 0);
    this.openModal(
      'offline',
      'Welcome back, Chief',
      `<p>You were away for <b>${fmtTime(r.elapsed)}</b>. Your people kept working:</p>
       <div class="stats" style="font-size:15px">${gained.map(([k, v]) => `<span class="stat">${ico(k as ResId)} +${fmt(v as number)}</span>`).join('') || '<span class="stat">Nothing stored — storage may be full</span>'}
       ${r.arrivals > 0 ? `<span class="stat">${ico('pop')} +${r.arrivals} survivors</span>` : ''}
       ${r.built > 0 ? `<span class="stat">${ico('hammer')} ${r.built} constructions finished</span>` : ''}</div>`,
      `<button class="btn" data-act="close">Collect</button>`,
    );
    game.offline = null;
  }

  private raidResult(r: { won: boolean; n: number; reward?: ResBag & { legend?: number }; lost?: ResBag; kills?: number }) {
    if (r.won) {
      this.openModal(
        'raid',
        `Raid ${r.n} repelled`,
        `<p>The raiders are scattered across the plain. The griots will sing of this night.</p><div class="stats" style="font-size:15px">${rewardChips(r.reward ?? {})}</div>`,
        `<button class="btn gold" data-act="close">Collect</button>`,
      );
    } else {
      this.banner('Dawn breaks', 'The raiders fled with part of your stores', 'danger');
      this.openModal(
        'raid',
        'The raiders got away',
        `<p>At first light the raiders fled into the bush, carrying stolen goods:</p><div class="stats">${Object.entries(r.lost ?? {})
          .map(([k, v]) => `<span class="stat">${ico(k as ResId)} −${fmt(v as number)}</span>`)
          .join('')}</div><p style="margin-top:8px">Build watchtowers, walls and a Warrior Lodge — and call on Legends.</p>`,
        `<button class="btn" data-act="close">Rebuild</button>`,
      );
    }
  }

  private eraModal(id: number) {
    const era = ERAS.find((e) => e.id === id)!;
    const unlocked = BUILD_ORDER.map((b) => BUILDINGS[b]).filter((d) => d.hqRequired === era.hqLevel);
    const heroes = HEROES.filter((h) => h.era === id);
    this.banner(era.name, era.tagline, 'good');
    this.openModal(
      'era',
      era.name,
      `<p class="story">${era.tagline}</p>
       ${unlocked.length ? `<p><b>New buildings:</b> ${unlocked.map((d) => d.name).join(', ')}</p>` : ''}
       ${heroes.length ? `<p><b>New legends can be summoned:</b> ${heroes.map((h) => h.name).join(', ')}</p>` : ''}`,
      `<button class="btn gold" data-act="close">Onward</button>`,
    );
  }

  private openSeasonInfo() {
    const s = game.state;
    const cur = seasonAt(s.time);
    const emoji: Record<string, string> = { longrains: '🌧', harvest: '🌾', harmattan: '🌬', dry: '☀' };
    const rows = SEASONS.map((sd) => {
      const mults = Object.entries(sd.mult)
        .map(([k, v]) => `<span class="stat">${k === 'crop' ? '🌽 crops' : ico(k as ResId)} ${(v as number) >= 1 ? '+' : ''}${Math.round(((v as number) - 1) * 100)}%</span>`)
        .join('');
      const now = sd.id === cur.id;
      return `<div style="padding:6px;margin-bottom:6px;${now ? 'background:rgba(255,220,120,.35);border-radius:10px' : ''}"><b>${emoji[sd.id]} ${sd.name}</b>${now ? ' — now' : ''}<div style="font-size:12px">${sd.desc}</div><div class="stats" style="margin-top:3px">${mults}<span class="stat">⚔ raids ×${sd.raid}</span></div></div>`;
    })
      .join('');
    this.openModal('seasons', 'Seasons of the savanna', `<p>Each season lasts 3 days. Raids come every second night from day 3.</p>${rows}`);
  }

  private openSettings() {
    this.openModal(
      'settings',
      'Settings',
      `<p><b>Sankofa</b> v0.1 — an offline survival city-builder.</p>
       <p style="font-size:12px">Progress saves automatically on this device. Farm art from Kenney's Isometric Miniature Farm (CC0, kenney.nl); everything else is drawn in code.</p>
       <p style="font-size:12px">Heroes are inspired by real historical figures; their in-game stories are short summaries.</p>`,
      `<button class="btn red" data-act="reset">Start over</button><button class="btn" data-act="close">Close</button>`,
      (act, e) => {
        if (act === 'reset') {
          // Two taps: the first arms the button, the second erases.
          const btn = (e.target as HTMLElement).closest('button')!;
          btn.setAttribute('data-act', 'reset-confirm');
          btn.textContent = 'Tap again to erase';
        }
        if (act === 'reset-confirm') {
          this.closeModal();
          game.reset();
          this.introModal();
        }
      },
    );
  }

  // ------------------------------------------------------------ legends

  private openLegends() {
    this.openModal('legends', 'Legends of Africa', '', '', (act, e) => {
      if (act === 'hero') {
        const id = (e.target as HTMLElement).closest('[data-id]')!.getAttribute('data-id')!;
        this.openHero(id);
      }
    });
    this.renderLegends();
  }

  private renderLegends() {
    if (!this.modal) return;
    const s = game.state;
    const hasGriot = s.buildings.some((b) => b.type === 'griot' && b.level > 0);
    const eraId = eco.era(s).id;
    const cards = HEROES.map((h) => {
      const owned = s.heroes.find((x) => x.id === h.id);
      const ready = !owned && hasGriot && eraId >= h.era && s.legend >= h.cost;
      const locked = !owned && eraId < h.era;
      return `<div class="hcard ${owned ? '' : 'locked'} ${ready ? 'ready' : ''}" data-act="hero" data-id="${h.id}">
        <img src="${portraitUrl(h)}" alt="">${owned ? `<span class="hlvl">Lv ${owned.level}</span>` : ''}
        <div class="hname">${h.name}</div>
        <div class="hrole">${locked ? `🔒 ${ERAS[h.era - 1].name}` : owned ? h.role : `${ico('legend').replace('<img', '<img style="width:14px;height:14px"')} ${h.cost}`}</div></div>`;
    }).join('');
    const body = this.modal.querySelector('.mbody') as HTMLElement;
    setHtml(
      body,
      `<p style="margin-top:0">${hasGriot ? `You have <b>${s.legend}</b> legend tokens. Earn more by repelling raids and finishing quests.` : 'Plant the <b>Griot Baobab</b> (Hearth level 3) to summon legends.'}</p><div class="hero-grid">${cards}</div>`,
    );
  }

  private openHero(id: string) {
    const bg = this.openModal('hero', HERO_BY_ID[id].name, '', '', (act) => {
      if (act === 'summon') {
        if (game.summon(id)) this.banner(HERO_BY_ID[id].name, `${HERO_BY_ID[id].title} answers your call!`, 'good');
      }
      if (act === 'levelup') game.upgradeHero(id);
      if (act === 'back') this.openLegends();
    });
    bg.dataset.id = id;
    this.renderHero(id);
  }

  private renderHero(id: string) {
    if (!this.modal) return;
    const s = game.state;
    const h = HERO_BY_ID[id];
    const owned = s.heroes.find((x) => x.id === id);
    const lvl = owned?.level ?? 1;
    const st = heroStats(h, lvl);
    let action = '';
    if (!owned) {
      const r = eco.canSummon(s, id);
      action = `<button class="btn gold" data-act="summon" ${r.ok ? '' : 'disabled'}>Summon ${ico('legend')}${h.cost}${r.ok ? '' : `<small>${(r as { reason: string }).reason}</small>`}</button>`;
    } else {
      const c = heroUpgradeCost(lvl);
      const max = eco.heroMaxLevel(s);
      const can = lvl < max && s.legend >= c.legend && s.res.food >= c.food;
      action =
        lvl >= max
          ? `<button class="btn" disabled>Max level<small>Upgrade the Griot Baobab</small></button>`
          : `<button class="btn" data-act="levelup" ${can ? '' : 'disabled'}>Level up <span class="chip ${s.legend < c.legend ? 'bad' : ''}">${ico('legend')}${c.legend}</span>${costChips({ food: c.food })}</button>`;
    }
    const body = this.modal.querySelector('.mbody') as HTMLElement;
    setHtml(
      body,
      `<div class="hero-detail"><img class="portrait" src="${portraitUrl(h)}" alt="">
       <div><h3>${h.name}</h3><div class="htitle">${h.title}</div><div class="horigin">${h.origin}</div>
       <p style="font-size:13px">${h.story}</p>
       <div class="stats"><span class="stat">${h.role}</span><span class="stat">❤ ${st.hp}</span><span class="stat">${ico('sword')} ${st.damage.toFixed(0)}</span>
       <span class="stat">${ico('star')} ${bonusText(h.bonus)}${owned && lvl > 1 ? ` (×${(1 + 0.1 * (lvl - 1)).toFixed(1)})` : ''}</span>${owned ? `<span class="stat">Level ${lvl}</span>` : ''}</div>
       <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">${action}<button class="btn wood" data-act="back">All legends</button></div></div></div>`,
    );
  }
}

