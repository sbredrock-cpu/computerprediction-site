// Marks the current page in the main navigation.
(function () {
  const page = document.querySelector('header.nav')?.dataset.page;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === page) a.setAttribute('aria-current', 'page');
  });
})();

// Scoreboard: say "Yesterday" only when the latest graded day really was yesterday.
(function () {
  var row = document.querySelector('.sb-row[data-date]');
  if (!row) return;
  var d = new Date(), y = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
  var ys = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  if (row.getAttribute('data-date') !== ys) row.querySelector('.sb-k').firstChild.nodeValue = 'Last graded day';
})();

// Sticky "free pick" button: shows once the email form has scrolled out of view.
(function () {
  var form = document.getElementById('unlock'), btn = document.querySelector('.sticky-cta');
  if (!form || !btn || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (e) {
    var past = !e[0].isIntersecting && e[0].boundingClientRect.top < 0;
    btn.classList.toggle('show', past);
  }).observe(form);
})();

// Scoreboard: show one results line at a time and flip upward every 4 seconds.
(function () {
  var rows = document.querySelector('.sb-rows');
  if (!rows || rows.children.length < 2) return;
  var n = rows.children.length, i = 0;
  rows.appendChild(rows.children[0].cloneNode(true)).setAttribute('aria-hidden', 'true');
  setInterval(function () {
    if (document.hidden) return;
    var h = rows.children[0].offsetHeight;
    i++;
    rows.style.transform = 'translateY(' + (-i * h) + 'px)';
    if (i === n) setTimeout(function () {
      rows.classList.add('jump'); rows.style.transform = 'translateY(0)'; i = 0;
      void rows.offsetHeight; rows.classList.remove('jump');
    }, 600);
  }, 4000);
})();
