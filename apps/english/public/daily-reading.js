// Daily totals count explicitly completed readings, using the reader's local date.
window.DailyReading = (() => {
  const day = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function clean(log) {
    return Array.isArray(log) ? log.filter(e => e && typeof e.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.title === 'string' && Number.isFinite(e.words) && e.words >= 0).map(e => ({id:e.id,date:e.date,title:e.title,words:e.words})) : [];
  }
  function toggle(state, id, completed, title, words) {
    state.dailyReadings = clean(state.dailyReadings).filter(e => e.id !== id);
    if (completed) state.dailyReadings.push({id, date:day(), title, words});
  }
  function mount(host, state, subject) {
    host.replaceChildren();
    host.style.cssText='margin:0 0 24px;padding:16px;border:1px solid var(--line);border-radius:10px;font:14px/1.6 system-ui;overflow-wrap:anywhere';
    const entries=clean(state.dailyReadings), today=day();
    const total=items => (items.reduce((sum,e)=>sum+e.words,0)/250).toFixed(1);
    const details=document.createElement('details');
    const summary=document.createElement('summary');
    summary.style.cursor='pointer';
    const todayEntries=entries.filter(e=>e.date===today);
    summary.textContent=`Daily reading · Today: ${total(todayEntries)} estimated pages · ${todayEntries.length} sections`;
    details.append(summary);
    const hint=document.createElement('p');
    hint.textContent='Mark a section as read to record it today. One estimated page = 250 words, not a printed page. Undoing a reading removes its entry. Earlier completions without dates are not assigned to today. Progress stays in this browser; download reports for your records.';
    details.append(hint);
    const label=document.createElement('label');label.textContent='Report period: ';
    const select=document.createElement('select');select.id='daily-period';
    for(const [value,text] of [['today','Today'],['week','Last 7 days'],['all','All recorded days']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)}
    label.append(select);details.append(label);
    const report=document.createElement('textarea');report.id='daily-report';report.readOnly=true;report.setAttribute('aria-label','Reading progress report');report.style.cssText='display:block;width:100%;min-height:230px;margin:12px 0;padding:12px;background:var(--panel);color:inherit;border:1px solid var(--line);border-radius:8px;font:13px/1.6 system-ui';
    const status=document.createElement('p');status.setAttribute('role','status');
    function update(){
      const start=new Date();start.setDate(start.getDate()-6);
      const from=select.value==='today'?today:select.value==='week'?day(start):'0000-00-00';
      const chosen=entries.filter(e=>e.date>=from&&e.date<=today);
      const lines=[`${subject} — reading progress`, `Period: ${select.options[select.selectedIndex].text} (through ${today}, local dates)`, `${chosen.length} completed sections; ${total(chosen)} estimated pages (${chosen.reduce((n,e)=>n+e.words,0)} words).`, 'Page estimate: 250 words per page. These are self-marked reading completions, not a mastery assessment.', ''];
      if(!chosen.length)lines.push('No dated reading completions in this period.');
      for(const date of [...new Set(chosen.map(e=>e.date))].sort().reverse()){
        const group=chosen.filter(e=>e.date===date);
        lines.push(`${date}: ${total(group)} estimated pages; ${group.length} sections`);
        for(const e of group)lines.push(`- ${e.title} (${(e.words/250).toFixed(1)} estimated pages)`);
        lines.push('');
      }
      report.value=lines.join('\n');status.textContent='';
    }
    select.onchange=update;update();details.append(report);
    const copy=document.createElement('button');copy.id='daily-copy';copy.textContent='Copy report for GPT';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(report.value);status.textContent='Copied. Paste into your GPT chat.'}catch{report.focus();report.select();status.textContent='Select and copy the report above, then paste it into your GPT chat.'}};
    const download=document.createElement('button');download.textContent='Download report';download.style.margin='8px';
    download.onclick=()=>{const url=URL.createObjectURL(new Blob([report.value],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=`${subject.toLowerCase()}-progress-${today}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
    details.append(copy,download,status);host.append(details);
  }
  return {day,clean,toggle,mount};
})();
