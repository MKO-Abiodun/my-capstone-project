export class Router {
  #routes = [];

  add(method, path, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Route handler must be a function');
    }

    this.#routes.push({
      method: method.toUpperCase(),
      segments: splitPath(path),
      handler
    });
    return this;
  }

  match(method, path) {
    const requestSegments = splitPath(path);

    for (const route of this.#routes) {
      if (route.method !== method.toUpperCase() ||
          route.segments.length !== requestSegments.length) {
        continue;
      }

      const entries = [];
      let matches = true;

      for (let index = 0; index < route.segments.length; index++) {
        const routeSegment = route.segments[index];
        const requestSegment = requestSegments[index];

        if (routeSegment.startsWith(':')) {
          entries.push([routeSegment.slice(1), decodeURIComponent(requestSegment)]);
        } else if (routeSegment !== requestSegment) {
          matches = false;
          break;
        }
      }

      if (matches) {
        return { handler: route.handler, params: Object.fromEntries(entries) };
      }
    }

    return null;
  }
}

export function createRouter() {
  return new Router();
}

function splitPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new TypeError('Route path must start with "/"');
  }
  return path.slice(1).split('/');
}
