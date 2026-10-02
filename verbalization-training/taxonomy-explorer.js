// Static, local-only browsing of the saved taxonomy. No model or analytics calls.
export function highlightVerbalization(container, text, spans = []) {
  const ranges = [];
  for (const span of new Set(spans)) {
    if (!span) continue;
    let start = text.indexOf(span);
    while (start !== -1) {
      ranges.push([start, start + span.length]);
      start = text.indexOf(span, start + 1);
    }
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  container.replaceChildren();
  let cursor = 0;
  for (const [start, end] of merged) {
    container.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement("mark");
    mark.className = "vea-highlight";
    mark.title = "Judge-identified evaluation-awareness verbalization";
    mark.textContent = text.slice(start, end);
    container.append(mark);
    cursor = end;
  }
  container.append(document.createTextNode(text.slice(cursor)));
}

export function promptDatasetLink(row) {
  const link = document.createElement("a");
  link.className = "dataset-record-link";
  link.href = row.dataset_url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = `Prompt ${row.prompt_id} ↗`;
  link.title = "Open this response in the public Hugging Face dataset";
  return link;
}

export function initExplorer(data) {
  const get = id => document.getElementById(id);
  const controls = Object.fromEntries(["model", "scope", "search", "confidence", "grounding", "grouping"].map(key => [key, get(`filter-${key}`)]));
  const node = (tag, className = "", text = "") => {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = text;
    return el;
  };
  const informalFrame = "user_informally_testing_assistant";
  let frame = informalFrame;
  let matching = [];
  let reasoningPromise;
  const models = Object.keys(data.models);
  const records = [...data.records].sort((a, b) => models.indexOf(a.model) - models.indexOf(b.model) || a.prompt_id.localeCompare(b.prompt_id) || a.policy.localeCompare(b.policy));
  const searchIndex = new Map(records.map(row => [row.case_id, [row.prompt, row.excerpt, row.hypothesis, row.explanation].join("\n").toLocaleLowerCase()]));
  const frameKeys = Object.keys(data.frames).filter(key => records.some(row => row.frame === key));
  for (const [control, labels] of [["model", data.models], ["confidence", data.confidence], ["grounding", data.grounding]]) {
    for (const [key, label] of Object.entries(labels)) {
      const option = node("option", "", label);
      option.value = key;
      controls[control].append(option);
    }
  }

  function scopeMatches(row) {
    const scope = controls.scope.value;
    return scope === "all" || (scope === "new" ? row.transition === "trained_only" : row.policy === scope);
  }

  function filteredPool() {
    const query = controls.search.value.trim().toLocaleLowerCase();
    return records.filter(row => scopeMatches(row)
      && (controls.model.value === "all" || row.model === controls.model.value)
      && (controls.confidence.value === "all" || row.confidence === controls.confidence.value)
      && (controls.grounding.value === "all" || row.grounding === controls.grounding.value)
      && (!query || searchIndex.get(row.case_id).includes(query)));
  }

  function loadReasoning() {
    if (!reasoningPromise) reasoningPromise = fetch(data.reasoning_file).then(response => {
      if (!response.ok) throw new Error("Could not load full reasoning.");
      return response.json();
    }).catch(error => { reasoningPromise = null; throw error; });
    return reasoningPromise;
  }

  function caseCard(row) {
    const card = node("details", "case-card");
    card.dataset.caseId = row.case_id;
    const summary = node("summary");
    const policy = row.policy === "trained" ? "VT" : "Base";
    const transition = row.transition === "trained_only" ? " · New VT positive" : row.transition === "base_only" ? " · Base-only positive" : " · Positive under both policies";
    summary.append(node("span", "case-meta", `${data.models[row.model]} · ${policy}${transition}`));
    const preview = row.prompt.replace(/\s+/g, " ").trim();
    summary.append(document.createTextNode(preview.length > 135 ? `${preview.slice(0, 135)}…` : preview));
    card.append(summary);
    let rendered = false;
    card.addEventListener("toggle", () => {
      if (!card.open || rendered) return;
      rendered = true;
      const content = node("div", "case-content");
      content.append(node("span", "example-label", "Full user prompt"), node("p", "raw full-prompt", row.prompt));
      content.append(node("span", "example-label", `Verbatim excerpt from ${policy} reasoning`));
      if (row.excerpt) {
        const quote = node("blockquote");
        highlightVerbalization(quote, row.excerpt, row.excerpt_spans);
        content.append(quote);
      }
      else content.append(node("p", "examples-note", "No exact excerpt could be matched to the saved reasoning. Open the full trace below."));

      const full = node("details", "reasoning-details");
      full.append(node("summary", "", "Read the full saved reasoning"));
      const reasoning = node("div", "raw full-reasoning");
      full.append(reasoning);
      let loaded = false;
      let loading = false;
      full.addEventListener("toggle", async () => {
        if (!full.open || loaded || loading) return;
        loading = true;
        reasoning.textContent = "Loading the saved reasoning…";
        try {
          const texts = await loadReasoning();
          if (typeof texts[row.case_id] !== "string") throw new Error("Saved reasoning not found for this response.");
          highlightVerbalization(reasoning, texts[row.case_id], row.verbalization_spans);
          loaded = true;
        } catch (error) {
          reasoning.textContent = `${error.message} Close and reopen to retry.`;
        } finally { loading = false; }
      });
      content.append(full);

      const judge = node("details", "judge-details");
      judge.append(node("summary", "", "Luna’s classification and explanation"));
      judge.append(node("p", "", `Suspected target: ${row.hypothesis}`), node("p", "", row.explanation));
      const tags = node("div", "case-labels");
      [data.targets[row.target], data.confidence[row.confidence], data.grounding[row.grounding], ...row.cues.map(key => data.cues[key])].forEach(label => tags.append(node("span", "", label)));
      judge.append(tags);
      const source = node("div", "case-id");
      source.append(promptDatasetLink(row), document.createTextNode(` · Response ${row.case_id}`));
      content.append(judge, source);
      card.append(content);
    });
    return card;
  }

  function categoryGroup(key, label, rows) {
    const group = node("details", "category-group");
    group.id = `cases-${frame}-${controls.grouping.value}-${key}`;
    group.dataset.category = key;
    const summary = node("summary", "", label);
    summary.append(node("span", "group-count", `${rows.length} responses`));
    group.append(summary);
    let rendered = false;
    group.addEventListener("toggle", () => {
      if (!group.open || rendered) return;
      rendered = true;
      const modelCounts = models.map(model => `${data.models[model]}: ${rows.filter(row => row.model === model).length}`).join(" · ");
      group.append(node("p", "examples-note group-description", modelCounts));
      const list = node("div", "case-list");
      rows.forEach(row => list.append(caseCard(row)));
      group.append(list);
    });
    return group;
  }

  function chooseFrame(key) {
    frame = key;
    // Safety's primary target is usually safety itself; cue groups are more useful.
    controls.grouping.value = key === "safety_or_policy_trap" ? "cue" : "target";
    render();
  }

  function render() {
    const pool = filteredPool();
    matching = pool.filter(row => row.frame === frame);
    const buttons = get("frame-buttons");
    buttons.replaceChildren();
    for (const key of frameKeys) {
      const n = pool.filter(row => row.frame === key).length;
      if (!n && key !== frame && ![informalFrame, "safety_or_policy_trap", "formal_evaluation_or_benchmark"].includes(key)) continue;
      const button = node("button", "", data.frames[key]);
      button.type = "button";
      button.dataset.frame = key;
      button.setAttribute("aria-pressed", String(key === frame));
      button.append(node("b", "", String(n)));
      button.addEventListener("click", () => chooseFrame(key));
      buttons.append(button);
    }
    const modelText = controls.model.value === "all" ? "all three models" : data.models[controls.model.value];
    const scopeText = controls.scope.selectedOptions[0].textContent.toLowerCase();
    get("explorer-status").textContent = `${matching.length} ${data.frames[frame].toLowerCase()} · ${modelText} · ${scopeText}. ${pool.length} responses match the filters across all kinds of test.`;
    const cues = controls.grouping.value === "cue";
    get("group-column-label").textContent = cues ? "Cue behind the suspicion" : "Suspected target";
    get("grouping-note").textContent = cues
      ? "Cue labels can overlap: a response can appear in several groups. Shares use the number of matching responses in this kind of test."
      : "Each response has one primary target. Shares are within this kind of test, after filtering. Click a target to open all its examples.";
    const table = get("explorer-targets");
    const groups = get("category-groups");
    table.replaceChildren();
    groups.replaceChildren();
    const labels = cues ? data.cues : data.targets;
    for (const [key, label] of Object.entries(labels)) {
      const rows = matching.filter(row => cues ? row.cues.includes(key) : row.target === key);
      if (!rows.length) continue;
      const group = categoryGroup(key, label, rows);
      groups.append(group);
      const tr = node("tr");
      tr.dataset.category = key;
      const th = node("th");
      th.scope = "row";
      const link = node("a", "category-link", label);
      link.href = `#${group.id}`;
      link.addEventListener("click", event => {
        event.preventDefault();
        group.open = true;
        group.scrollIntoView({behavior: "instant", block: "start"});
        group.querySelector("summary").focus({preventScroll: true});
      });
      th.append(link);
      tr.append(th, node("td", "", String(rows.length)), node("td", "", `${(100 * rows.length / matching.length).toFixed(1)}%`));
      table.append(tr);
    }
    get("explorer-table").hidden = !matching.length;
    get("download-cases").disabled = !matching.length;
    if (!matching.length) groups.append(node("p", "empty-results", "No responses match this combination. Try another model, a different kind of test, or reset the filters."));
  }

  for (const control of Object.values(controls)) control.addEventListener(control.type === "search" ? "input" : "change", render);
  get("reset-filters").addEventListener("click", () => {
    for (const key of ["model", "confidence", "grounding"]) controls[key].value = "all";
    controls.scope.value = "new";
    controls.search.value = "";
    chooseFrame(informalFrame);
  });
  get("collapse-categories").addEventListener("click", () => {
    get("category-groups").querySelectorAll("details").forEach(group => { group.open = false; });
  });
  get("download-cases").addEventListener("click", () => {
    const payload = {filters: {frame, ...Object.fromEntries(Object.entries(controls).map(([key, el]) => [key, el.value]))}, count: matching.length, cases: matching};
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type: "application/json"}));
    const link = Object.assign(document.createElement("a"), {href: url, download: "wildchat-filtered-cases.json"});
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  document.querySelectorAll("[data-explore-frame]").forEach(link => link.addEventListener("click", () => chooseFrame(link.dataset.exploreFrame)));
  render();
}
