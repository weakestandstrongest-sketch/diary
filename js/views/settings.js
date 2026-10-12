// せってい画面
import * as store from '../store.js';
import { eventsToICS, parseICS, downloadFile } from '../events.js';
import { toast } from '../ui.js';
import { esc, todayKey } from '../util.js';

export function render(root) {
  const data = store.getData();
  root.innerHTML = `
  <div class="screen rpg settings">
    <div class="screen-inner">
      <header class="rpg-header"><h1>せってい</h1></header>

      <section class="win">
        <span class="win-title">ぼうけんしゃ</span>
        <label class="field" for="name">なまえ</label>
        <form class="add-row" data-form="name" style="margin-top:0">
          <input id="name" class="px-input" name="name" maxlength="10" value="${esc(data.profile.name)}" />
          <button class="pxbtn" type="submit">けってい</button>
        </form>
      </section>

      <section class="win">
        <span class="win-title">ぼうけんのしょ（バックアップ）</span>
        <p class="help">データは この iPhone の中だけに ほぞんされます。きしゅへんこう や もしものときに そなえて、ときどき かきだしておきましょう。</p>
        <button class="pxbtn block" data-act="export">ぼうけんのしょを かきだす（.json）</button>
        <label class="pxbtn block" style="text-align:center">ぼうけんのしょを よみこむ
          <input type="file" accept=".json,application/json" data-file="json" class="visually-hidden" />
        </label>
      </section>

      <section class="win">
        <span class="win-title">カレンダー れんけい（.ics）</span>
        <p class="help">iPhone 純正カレンダーや Google カレンダーから かきだした .ics を よみこめます。ぎゃくに、この アプリの よていを .ics に して 純正カレンダーへ ついかすることも できます。</p>
        <label class="field" for="ics-cal">よみこみさきの カレンダー</label>
        <select id="ics-cal" class="px-input" data-ics-cal>
          ${data.calendars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <label class="pxbtn block" style="text-align:center">.ics を よみこむ
          <input type="file" accept=".ics,text/calendar" data-file="ics" class="visually-hidden" />
        </label>
        <button class="pxbtn block" data-act="export-ics">すべての よていを .ics に かきだす</button>
      </section>

      <section class="win">
        <span class="win-title">じぶんで ついかした こうどう</span>
        ${
          data.customActivities.length
            ? `<div class="chips">${data.customActivities
                .map((a) => `<button class="chip" data-del-act="${esc(a.id)}" aria-label="${esc(a.label)} をけす">${esc(a.label)} ✕</button>`)
                .join('')}</div>`
            : '<p class="help">にっきの「こうどう」から ついかできます。</p>'
        }
      </section>

      <section class="win">
        <span class="win-title">iPhone に インストール</span>
        <ol>
          <li>Safari で この ページを ひらく</li>
          <li>きょうゆうボタン（□↑）を タップ</li>
          <li>「ホーム画面に追加」を えらぶ</li>
        </ol>
        <p class="help">ホーム画面から ひらくと、アプリのように ぜんがめんで つかえます。オフラインでも うごきます。</p>
      </section>

      <section class="win">
        <span class="win-title">きけん</span>
        <button class="pxbtn danger block" data-act="reset">すべての データを けす</button>
      </section>

      <p class="dim" style="text-align:center;font-size:12px">ドット絵クエスト日記 v1.0</p>
    </div>
  </div>`;

  const screen = root.querySelector('.screen');

  screen.querySelector('[data-form="name"]').addEventListener('submit', (e) => {
    e.preventDefault();
    store.setProfileName(e.target.elements.name.value);
    toast(`なまえを「${store.getData().profile.name}」に した！`);
  });

  screen.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'export') {
      downloadFile(`pixel-quest-diary-${todayKey()}.json`, store.exportJSON(), 'application/json');
    } else if (b.dataset.act === 'export-ics') {
      if (!store.getData().events.length) return toast('よていが まだ ありません');
      downloadFile(`pixel-quest-diary-${todayKey()}.ics`, eventsToICS(store.getData().events), 'text/calendar');
    } else if (b.dataset.act === 'reset') {
      if (confirm('ほんとうに すべての データを けしますか？\n（にっき・よてい・レベルが すべて きえます）')) {
        if (confirm('ほんとうに ほんとうに けしますか？')) {
          store.resetAll();
          toast('ぼうけんのしょは きえてしまった…');
        }
      }
    } else if (b.dataset.delAct) {
      store.removeCustomActivity(b.dataset.delAct);
    }
  });

  screen.addEventListener('change', async (e) => {
    const input = e.target;
    if (!input.dataset.file || !input.files[0]) return;
    const text = await input.files[0].text();
    try {
      if (input.dataset.file === 'json') {
        if (!confirm('いまの データを うわがきして よみこみますか？')) return;
        store.importJSON(text);
        toast('ぼうけんのしょを よみこんだ！');
      } else {
        const cal = screen.querySelector('[data-ics-cal]').value;
        const events = parseICS(text, cal);
        if (!events.length) throw new Error('よていが みつかりませんでした');
        store.addEvents(events);
        toast(`よていを ${events.length}けん よみこんだ！`);
      }
    } catch (err) {
      toast('よみこみに しっぱい: ' + err.message);
    } finally {
      input.value = '';
    }
  });
}
