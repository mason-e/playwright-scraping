const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const port = Number(process.env.PORT || 3000);
const resultsPath = path.join(__dirname, '..', 'data', 'search-results.json');
const applicationsPath = path.join(__dirname, '..', 'data', 'jobs-applied.json');
const blacklistPath = path.join(__dirname, '..', 'data', 'blacklist.json');
const blacklistReasonsPath = path.join(__dirname, '..', 'data', 'blacklist-reasons.json');
const pagePath = path.join(__dirname, 'results.html');
const applicationsPagePath = path.join(__dirname, 'apps.html');
const stylesheetPath = path.join(__dirname, 'styles.css');
const applicationModalPath = path.join(__dirname, 'application-modal.js');
const blacklistModalPath = path.join(__dirname, 'blacklist-modal.js');

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readRequestJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw new Error('Request body is too large');
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function currentDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

async function loadBlacklistReasons() {
  try {
    const reasons = JSON.parse(await fs.readFile(blacklistReasonsPath, 'utf8'));
    if (!Array.isArray(reasons)) {
      throw new Error('Blacklist reasons must be a JSON array');
    }

    const validReasons = reasons.filter((reason) => typeof reason === 'string' && reason.trim());
    return validReasons.length ? validReasons : ['Other'];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return ['Other'];
    }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');

  try {
    if (url.pathname === '/' && request.method === 'GET') {
      response.writeHead(302, { Location: '/results.html' });
      response.end();
      return;
    }

    if (url.pathname === '/results.html' && request.method === 'GET') {
      const page = await fs.readFile(pagePath);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(page);
      return;
    }

    if (url.pathname === '/apps.html' && request.method === 'GET') {
      const page = await fs.readFile(applicationsPagePath);
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(page);
      return;
    }

    if (url.pathname === '/styles.css' && request.method === 'GET') {
      const stylesheet = await fs.readFile(stylesheetPath);
      response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      response.end(stylesheet);
      return;
    }

    if (url.pathname === '/application-modal.js' && request.method === 'GET') {
      const script = await fs.readFile(applicationModalPath);
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(script);
      return;
    }

    if (url.pathname === '/blacklist-modal.js' && request.method === 'GET') {
      const script = await fs.readFile(blacklistModalPath);
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(script);
      return;
    }

    if (url.pathname === '/api/jobs') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const jobs = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
      sendJson(response, 200, jobs);
      return;
    }

    if (url.pathname === '/api/applications') {
      if (request.method === 'POST') {
        const body = await readRequestJson(request);
        const requiredFields = ['company', 'title', 'appDate', 'appMethod', 'location'];
        if (
          !body || typeof body !== 'object' || Array.isArray(body) ||
          requiredFields.some((field) => typeof body[field] !== 'string' || !body[field].trim()) ||
          !isIsoDate(body.appDate) ||
          !['interviewed', 'advanced'].every((field) => typeof body[field] === 'boolean') ||
          (body.contact !== undefined && typeof body.contact !== 'string')
        ) {
          sendJson(response, 400, { error: 'Invalid application record' });
          return;
        }

        const applications = JSON.parse(await fs.readFile(applicationsPath, 'utf8'));
        if (!Array.isArray(applications)) {
          throw new Error('Applied jobs must be a JSON array');
        }

        const application = {
          id: randomUUID(),
          company: body.company.trim(),
          title: body.title.trim(),
          appDate: body.appDate,
          appMethod: body.appMethod.trim(),
          location: body.location.trim(),
          interviewed: body.interviewed,
          advanced: body.advanced,
        };
        const contact = (body.contact || '').trim();
        if (contact) {
          application.contact = contact;
        }
        applications.push(application);

        const temporaryPath = `${applicationsPath}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(applications, null, 4)}\n`);
        await fs.rename(temporaryPath, applicationsPath);
        sendJson(response, 201, application);
        return;
      }

      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      let applications = JSON.parse(await fs.readFile(applicationsPath, 'utf8'));
      if (!Array.isArray(applications)) {
        throw new Error('Applied jobs must be a JSON array');
      }

      const searchFields = ['company', 'title', 'appMethod', 'location', 'contact'];
      const statusFields = ['interviewed', 'advanced'];
      const requestedField = url.searchParams.get('field');
      if (requestedField && !searchFields.includes(requestedField)) {
        sendJson(response, 400, { error: 'Unsupported application search field' });
        return;
      }

      const query = (url.searchParams.get('q') || '').trim().toLowerCase();
      const textFilters = searchFields
        .map((field) => [field, (url.searchParams.get(field) || '').trim().toLowerCase()])
        .filter(([, value]) => value);
      const statusFilters = statusFields
        .filter((field) => url.searchParams.has(field))
        .map((field) => [field, url.searchParams.get(field).toLowerCase()]);

      if (statusFilters.some(([, value]) => value !== 'true' && value !== 'false')) {
        sendJson(response, 400, { error: 'Status filters must be true or false' });
        return;
      }

      applications = applications.filter((application) => {
        const queryMatches = !query || (requestedField
          ? String(application[requestedField] ?? '').toLowerCase().includes(query)
          : searchFields.some((field) => String(application[field] ?? '').toLowerCase().includes(query)));
        const textFiltersMatch = textFilters.every(([field, value]) =>
          String(application[field] ?? '').toLowerCase().includes(value)
        );
        const statusFiltersMatch = statusFilters.every(([field, value]) =>
          String(application[field]).toLowerCase() === value
        );
        return queryMatches && textFiltersMatch && statusFiltersMatch;
      });
      sendJson(response, 200, applications);
      return;
    }

    if (url.pathname === '/api/blacklist/reasons') {
      if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      sendJson(response, 200, await loadBlacklistReasons());
      return;
    }

    if (url.pathname === '/api/blacklist') {
      if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const body = await readRequestJson(request);
      const validFields = ['company', 'title', 'location'];
      if (
        !body || typeof body !== 'object' || Array.isArray(body) ||
        !validFields.includes(body.field) ||
        typeof body.value !== 'string' || !body.value.trim() ||
        typeof body.reason !== 'string' || !body.reason.trim()
      ) {
        sendJson(response, 400, { error: 'Field, value, and reason are required' });
        return;
      }

      const entries = JSON.parse(await fs.readFile(blacklistPath, 'utf8'));
      if (!Array.isArray(entries)) {
        throw new Error('Blacklist data must be a JSON array');
      }

      const entry = {
        value: body.value.trim(),
        field: body.field,
        dateAdded: currentDate(),
        reason: body.reason.trim(),
      };
      entries.push(entry);

      const temporaryPath = `${blacklistPath}.tmp`;
      await fs.writeFile(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`);
      await fs.rename(temporaryPath, blacklistPath);
      sendJson(response, 201, entry);
      return;
    }

    if (url.pathname === '/api/jobs/read') {
      if (request.method !== 'PATCH') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const body = await readRequestJson(request);
      if (!body || !Array.isArray(body.ids) || !body.ids.every((id) => typeof id === 'string')) {
        sendJson(response, 400, { error: 'Expected an array of job IDs' });
        return;
      }

      const jobs = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
      if (!Array.isArray(jobs)) {
        throw new Error('Search results must be a JSON array');
      }

      const ids = new Set(body.ids);
      let updated = 0;
      for (const job of jobs) {
        if (ids.has(job.id) && job.isRead !== true) {
          job.isRead = true;
          updated += 1;
        }
      }

      if (updated > 0) {
        const temporaryPath = `${resultsPath}.tmp`;
        await fs.writeFile(temporaryPath, `${JSON.stringify(jobs, null, 2)}\n`);
        await fs.rename(temporaryPath, resultsPath);
      }

      sendJson(response, 200, { updated });
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, status, { error: status === 400 ? 'Invalid JSON' : 'Request failed' });
    console.error(error);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Results server listening at http://localhost:${port}`);
});