/**
 * Hash router.
 *
 * Hash-based on purpose: the console is served as plain static files with no
 * build step, so it must work when opened directly from the server without any
 * rewrite rules. Routes may carry a query string (`#/videos?status=pending`)
 * which is handed to the view.
 */
const routes = new Map();
let notFound = null;

export function register(path, view) {
  routes.set(path, view);
}

export function setNotFound(view) {
  notFound = view;
}

export function navigate(path) {
  if (location.hash.slice(1) === path) {
    // Same route: re-render rather than relying on a hashchange that will not fire.
    resolve();
    return;
  }
  location.hash = path;
}

export function currentPath() {
  return location.hash.replace(/^#/, '').split('?')[0] || '';
}

function resolve() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, search] = raw.split('?');
  const view = routes.get(path) ?? notFound;
  if (!view) return;

  const query = Object.fromEntries(new URLSearchParams(search ?? ''));
  view.render(document.getElementById('view'), { query, path });
  view.onEnter?.();
}

export function start() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
