// ==UserScript==
// @name         DIAWA Timekeeper
// @namespace    https://web.piber.at
// @version      2024-02-01
// @description  try to take over the world!
// @author       Constantin Piber
// @match        *://diawa.at/partners/index.php?*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=diawa.at
// @updateURL    https://raw.githubusercontent.com/cpiber/DiawaTimekeeper/main/main.js
// @downloadURL  https://raw.githubusercontent.com/cpiber/DiawaTimekeeper/main/main.js
// @sandbox      javascript
// @grant        GM_log
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(async function () {
  "use strict";

  const form = document.querySelector(".recording > form#form_new");
  if (!form) return;
  GM_log("Got the form");
  GM_addStyle(`
.ext-area {
  padding: 4px 0 8px;
}

.ext-main-row {
  text-align: right;
}

.background-primary,
.ext-button-main,
.ext-task {
  background-color: #7E57C2 !important; /* Deep Purple 400 */
}
.border-primary,
.ext-button-main,
.ext-task {
  border-color: #5E35B1 !important; /* Deep Purple 600 */
}
.text-primary,
.ext-button-main,
.ext-task {
  color: #FAFAFA !important; /* Grey 50 */
}
.background-secondary,
.ext-button-secondary {
  background-color: #42A5F5 !important; /* Blue 400 */
}
.border-secondary,
.ext-button-secondary {
  border-color: #1E88E5 !important; /* Blue 600 */
}
.text-secondary,
.ext-button-secondary {
  color: #212121 !important; /* Grey 900 */
}
.text-danger,
.ext-link-danger,
.ext-link-danger:visited,
.ext-link-danger:active {
  color: #F44336 !important; /* Red 500 */
}

.text-bold {
  font-weight: bold;
}

.ext-button,
.ext-button-main,
.ext-button-secondary {
  all: unset;
  padding: 0.5px 3px;
  border-radius: 2px;
  border: 1px solid;
  cursor: pointer;
}

.ext-button-main {
  padding: 2px 6px;
  font-size: 1.1em;
  font-weight: bold;
}

.ext-link,
.ext-link:visited,
.ext-link:active {
  color: inherit !important;
}
.ext-link:active,
.ext-link:hover,
.ext-link-danger:active,
.ext-link-danger:hover {
  text-decoration: underline dashed;
}

.ext-task {
  display: grid;
  grid-template-columns: [start] repeat(3, auto 1fr) auto [end];
  border-radius: 2px;
  border: 1px solid;
  gap: 6px;
  padding: 4px 6px;
  margin: 6px 0;
  align-items: center;
}

.ext-task [name="stop-wrapper"] {
  grid-column: span 2;
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 3px;
}

.ext-task [name="stop-wrapper"] .ext-link-danger {
  font-size: 0.7em;
}

.ext-main-row [name="apply-wrapper"] {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 3px;
  font-size: 0.9em;
}

.ext-summary {
  display: grid;
  grid-template-columns: [start] auto repeat(3, auto 1fr) [end];
  gap: 6px;
  align-items: center;
  margin-left: auto;
  width: min-content;
  white-space: nowrap;
}

.ext-summary .text-bold {
  margin-right: 6px;
}

.ext-area:not(.has-tasks) [name="apply-wrapper"],
.ext-area:not(.has-finished-tasks) [name="apply-wrapper"],
.ext-area:not(.has-tasks) .ext-summary,
.ext-area:not(.has-finished-tasks) .ext-summary,
.ext-area:not(.has-tasks) .ext-main-row > [name="clear"],
.ext-area.has-finished-tasks .ext-main-row > [name="clear"],
.ext-area.has-running-tasks [name="start-button"] {
  display: none;
}

.ext-task.has-ended .running,
.ext-task:not(.has-ended) .end {
  display: none;
}
  `);

  /** General helpers */

  /**
   * @param {string} tag
   * @param {Record<string, any> & { children?: Element[], textContent?: string, text?: string }} options
   * @returns {HTMLElement}
   */
  function create(tag, options = {}) {
    const el = document.createElement(tag);
    for (const key in options) {
      if (key === "textContent" || key === "text") {
        el.textContent = options[key];
      } else if (key === "children") {
        el.append.apply(el, options[key]);
      } else {
        el.setAttribute(key, options[key]);
      }
    }
    return el;
  }

  /**
   * @param {HTMLElement} el
   * @param {string} content
   */
  function setContent(el, content) {
    if (el.textContent !== content) el.textContent = content;
  }

  /**
   * @param {HTMLElement} el
   * @param {Date} date
   */
  function setTime(el, date) {
    if (el.dateTime !== date.toISOString()) el.dateTime = date.toISOString();
    setContent(el, date.toLocaleTimeString());
    el.style.display = "";
  }

  /**
   * @overload
   * @param {Date} startOrDuration
   * @param {Date} end
   * @returns {string}
   */
  /**
   * @overload
   * @param {number} startOrDuration
   * @returns {string}
   */
  /**
   * @param {Date|number} startOrDuration
   * @param {Date?} end
   * @returns {string}
   */
  function getDuration(startOrDuration, end = undefined) {
    const d =
      end !== undefined
        ? end.getTime() - startOrDuration.getTime()
        : startOrDuration;
    const duration = d / 1000 / 60 / 60;
    return duration.toFixed(2);
  }

  /**
   * @overload
   * @param {Date} startOrDuration
   * @param {Date} end
   * @returns {string}
   */
  /**
   * @overload
   * @param {number} startOrDuration
   * @returns {string}
   */
  /**
   * @param {Date|number} startOrDuration
   * @param {Date?} end
   * @returns {string}
   */
  function formatDuration(startOrDuration, end = undefined) {
    let duration =
      end !== undefined
        ? end.getTime() - startOrDuration.getTime()
        : startOrDuration;
    let retstr = "";
    if (duration > 60 * 60 * 1000) {
      const h = Math.floor(duration / (60 * 60 * 1000));
      retstr += `${h}h `;
      duration -= h * 60 * 60 * 1000;
    }
    if (duration > 60 * 1000) {
      const m = Math.floor(duration / (60 * 1000));
      retstr += `${m}m `;
      duration -= m * 60 * 1000;
    }
    const s = Math.floor(duration / 1000);
    retstr += `${s}s`;
    return retstr;
  }

  /**
   * @param {number} number
   * @param {number} digits
   * @returns {string}
   */
  function formatNumber(number, digits = 2) {
    const sig = Math.round(number);
    let ret = sig.toString();
    while (ret.length < digits) ret = "0" + ret;
    if (number - sig === 0) return ret;
    return ret + "." + (number - sig).toString();
  }

  /** Data */

  /**
   * @type {Array<{ start: Date, end?: Date }>}
   */
  const tasks = (await GM.getValue("tasks", [])).map((t) => {
    t.start = new Date(t.start);
    if ("end" in t) t.end = new Date(t.end);
    return t;
  });
  const total = {
    start: new Date(),
    end: new Date(),
    duration: 0,
  };
  /**
   * @type {{num:number,type:'start'|'end'}|undefined}
   */
  let currently_editing = undefined;

  /** UI */

  const wrap = create("div", { class: "ext-area" });
  form.parentElement.before(wrap);

  const summary = create("div", {
    class: "ext-summary",
    children: [
      create("span", { class: "text-bold", text: "Total:" }),
      create("span", { text: "Start:" }),
      create("time", { name: "start" }),
      create("span", { text: "End:", class: "end" }),
      create("time", { name: "end", class: "end" }),
      create("span", { text: "Duration:" }),
      create("span", { name: "duration" }),
    ],
  });
  const buttonrow = create("div", {
    class: "ext-main-row",
    children: [
      create("button", {
        text: "▶️ Start",
        class: "ext-button-main",
        name: "start-button",
      }),
      summary,
      create("div", {
        name: "apply-wrapper",
        children: [
          create("a", {
            name: "apply-hours",
            href: "#apply-hours",
            text: "apply hours",
            class: "ext-link",
          }),
          create("a", {
            name: "apply-time",
            href: "#apply-time",
            text: "apply times",
            class: "ext-link",
          }),
          create("a", {
            name: "apply-both",
            href: "#apply",
            text: "apply both",
            class: "ext-link",
          }),
          create("a", {
            name: "clear",
            href: "#clear",
            text: "clear",
            class: "ext-link-danger",
          }),
        ],
      }),
      create("a", {
        name: "clear",
        href: "#clear",
        text: "clear",
        class: "ext-link-danger",
      }),
    ],
  });
  wrap.append(buttonrow);

  const tasksrow = create("div", { class: "ext-tasks-row" });
  buttonrow.before(tasksrow);

  function renderTasks() {
    while (tasksrow.childElementCount < tasks.length) {
      tasksrow.append(
        create("div", {
          class: "ext-task",
          children: [
            create("span", { text: "Start:" }),
            create("time", { name: "start" }),
            create("span", { text: "End:", class: "end" }),
            create("time", { name: "end", class: "end" }),
            create("span", { text: "Duration:" }),
            create("span", { name: "duration" }),
            create("div", {
              class: "running",
              name: "stop-wrapper",
              children: [
                create("button", {
                  name: "stop-button",
                  text: "⏹️ Stop",
                  class: "ext-button-secondary",
                }),
              ],
            }),
            create("a", {
              name: "remove",
              href: "#remove",
              title: "remove",
              text: "❌",
              class: "ext-link-danger",
            }),
          ],
        })
      );
    }
    while (tasksrow.childElementCount > tasks.length)
      tasksrow.lastElementChild.remove();
    GM_log("render", tasks.length, "tasks");
    for (let i = 0; i < tasks.length; ++i) {
      const task = tasks[i];
      const taskel = tasksrow.children[i];
      setTime(taskel.querySelector('[name="start"]'), task.start);
      if (task.end) setTime(taskel.querySelector('[name="end"]'), task.end);
      setContent(
        taskel.querySelector('[name="duration"]'),
        formatDuration(task.start, task.end ? task.end : new Date())
      );
      taskel.classList.toggle("has-ended", !!task.end);
      taskel.dataset.task = i;
      if (currently_editing?.num !== i) {
        taskel
          .querySelectorAll("input.replace-input")
          .forEach((n) => n.remove());
        continue;
      }
      const displayEl =
        currently_editing.type === "start"
          ? taskel.querySelector('[name="start"]')
          : taskel.querySelector('[name="end"]');
      displayEl.style.display = "none";
      if (taskel.querySelector("input.replace-input")) continue;
      const replaceEl = create("input", {
        placeholder: `New ${currently_editing.type} time`,
        value: (currently_editing.type === "start" ? task.start : task.end)
          .toTimeString()
          .replace(/(\d\d?:\d{2}:\d{2}).*/, "$1"),
        type: "time",
        class: "replace-input",
      });
      displayEl.after(replaceEl);
    }
  }

  function renderSummary() {
    if (total.start === undefined || total.end === undefined) return;
    setTime(summary.querySelector('[name="start"]'), total.start);
    setTime(summary.querySelector('[name="end"]'), total.end);
    setContent(
      summary.querySelector('[name="duration"]'),
      formatDuration(total.duration)
    );
  }

  function renderMain() {
    wrap.classList.toggle(
      "has-running-tasks",
      tasks.some((e) => !("end" in e))
    );
    wrap.classList.toggle(
      "has-finished-tasks",
      tasks.some((e) => "end" in e)
    );
    wrap.classList.toggle("has-tasks", tasks.length > 0);

    calculateTotal();
    renderTasks();
    renderSummary();
  }

  // dynamic render
  {
    /** @type {number} */
    let previousTS = undefined; // ms
    /** @param {number} ts */
    function render(ts) {
      if (previousTS === undefined || ts - previousTS > 500) {
        renderMain();
        previousTS = ts;
      }
      unsafeWindow.requestAnimationFrame(render);
    }
    unsafeWindow.requestAnimationFrame(render);
  }

  /** Logic */

  function calculateTotal() {
    if (tasks.length <= 0) return;
    total.start = undefined;
    total.end = undefined;
    total.duration = 0;
    for (let i = 0; i < tasks.length; ++i) {
      if (!tasks[i].end) continue;
      if (
        total.start === undefined ||
        tasks[i].start.getTime() < total.start.getTime()
      )
        total.start = tasks[i].start;
      if (
        total.end === undefined ||
        tasks[i].end.getTime() < total.end.getTime()
      )
        total.end = tasks[i].end;
      total.duration += tasks[i].end.getTime() - tasks[i].start.getTime();
    }
  }

  /**
   * @param {typeof tasks} data
   */
  async function save(data = undefined) {
    if (data === undefined) data = tasks;
    await GM.setValue(
      "tasks",
      data.map((t) => ({
        ...t,
        start: t.start.getTime(),
        end: t.end?.getTime(),
      }))
    );
  }

  tasksrow.addEventListener("click", function (ev) {
    const taskel = /** @type {HTMLElement} */ (ev.target).closest(".ext-task");
    if (!taskel) return;
    ev.preventDefault();
    const name = ev.target.name ?? ev.target.getAttribute("name");
    if (name === "remove") {
      tasks.splice(+taskel.dataset.task, 1);
    } else if (name === "stop-button") {
      tasks[+taskel.dataset.task].end = new Date();
    } else if (name === "start" || name === "end") {
      if (currently_editing !== undefined) return;
      currently_editing = { num: +taskel.dataset.task, type: name };
    } else {
      return;
    }
    renderMain();
    save();
  });
  buttonrow.addEventListener("click", function (ev) {
    ev.preventDefault();
    const name = ev.target.name ?? ev.target.getAttribute("name");
    if (name === "start-button") {
      tasks.push({ start: new Date() });
      save();
    } else if (name === "clear") {
      tasks.splice(0);
      save();
    } else if (name === "apply-hours") {
      calculateTotal();
      document.getElementById("recording_hours").value = getDuration(
        total.duration
      );
    } else if (name === "apply-time") {
      calculateTotal();
      document.getElementById(
        "workingtime_start"
      ).value = `${total.start.getHours()}:${formatNumber(
        total.start.getMinutes()
      )}`;
      document.getElementById(
        "workingtime_end"
      ).value = `${total.end.getHours()}:${formatNumber(
        total.end.getMinutes()
      )}`;
    } else if (name === "apply-both") {
      calculateTotal();
      document.getElementById("recording_hours").value = getDuration(
        total.duration
      );
      document.getElementById(
        "workingtime_start"
      ).value = `${total.start.getHours()}:${formatNumber(
        total.start.getMinutes()
      )}`;
      document.getElementById(
        "workingtime_end"
      ).value = `${total.end.getHours()}:${formatNumber(
        total.end.getMinutes()
      )}`;
    } else {
      return;
    }
    if (["apply-hours", "apply-time", "apply-both"].indexOf(name) !== -1) {
      // fake-save no tasks for better experience
      // if the user navigates away after applying, they likely don't want to see the tasks again on next load
      save(tasks.filter((t) => !("end" in t)));
    }
    renderMain();
  });
  tasksrow.addEventListener("keyup", function (ev) {
    if (!ev.target.classList.contains("replace-input")) return;
    if (ev.key !== "Escape" && ev.key !== "Enter") return;
    const taskel = /** @type {HTMLElement} */ (ev.target).closest(".ext-task");
    if (!taskel) return;
    if (ev.key === "Enter" && currently_editing !== undefined) {
      const task = tasks[+taskel.dataset.task];
      const curVal = currently_editing.type === "start" ? task.start : task.end;
      const newVal = new Date(`1970-01-01T${ev.target.value}Z`);
      if (!curVal || isNaN(newVal.valueOf())) return;
      curVal.setHours(
        newVal.getUTCHours(),
        newVal.getUTCMinutes(),
        newVal.getUTCSeconds()
      );
    }
    currently_editing = undefined;
    save();
    renderMain();
  });
})();

