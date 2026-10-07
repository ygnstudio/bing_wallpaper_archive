/**
 * 主题切换（浅色 / 深色）
 * 初始值由各页 head 内联脚本写入（防闪烁），此处只负责绑定切换按钮
 * 并同步 meta theme-color。普通脚本，index 与 about 共用。
 */
(function () {
  var root = document.documentElement;

  function applyTheme(t) {
    root.dataset.theme = t;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#faf7f2' : '#0f172a');
  }

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var next = root.dataset.theme === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('bw-theme', next); } catch (e) { /* 隐私模式忽略 */ }
      applyTheme(next);
    });
  }

  // 跨标签页同步
  window.addEventListener('storage', function (e) {
    if (e.key === 'bw-theme' && e.newValue) applyTheme(e.newValue);
  });

  applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');
})();
