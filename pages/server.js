const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const port = Number(process.env.PORT || 3000);
const resultsPath = path.join(__dirname, '..', 'data', 'search-results.json');
const applicationsPath = path.join(__dirname, '..', 'data', 'jobs-applied.json');
const pagePath = path.join(__dirname, 'results.html');
const applicationsPagePath = path.join(__dirname, 'apps.html');
const stylesheetPath = path.join(__dirname, 'styles.css');
const applicationModalPath = path.join(__dirname, 'application-modal.js');

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

function jobKey(job) {
  return `${job.title || ''}|${job.company || ''}|${job.url || ''}`;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
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

      const applications = JSON.parse(await fs.readFile(applicationsPath, 'utf8'));
      if (!Array.isArray(applications)) {
        throw new Error('Applied jobs must be a JSON array');
      }
      sendJson(response, 200, applications);
      return;
    }

    if (url.pathname === '/api/jobs/read') {
      if (request.method !== 'PATCH') {
        sendJson(response, 405, { error: 'Method not allowed' });
        return;
      }

      const body = await readRequestJson(request);
      if (!body || !Array.isArray(body.keys) || !body.keys.every((key) => typeof key === 'string')) {
        sendJson(response, 400, { error: 'Expected an array of job keys' });
        return;
      }

      const jobs = JSON.parse(await fs.readFile(resultsPath, 'utf8'));
      if (!Array.isArray(jobs)) {
        throw new Error('Search results must be a JSON array');
      }

      const keys = new Set(body.keys);
      let updated = 0;
      for (const job of jobs) {
        if (keys.has(jobKey(job)) && job.isRead !== true) {
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