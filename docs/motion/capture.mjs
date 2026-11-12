import { chromium } from 'file:///C:/Users/R3/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1.5});
 await page.goto('https://provaai.vercel.app/',{waitUntil:'networkidle'});
 await page.screenshot({path:'docs/motion/assets/login.png'});
 await page.getByRole('button',{name:'Explorar demonstração'}).click();
 await page.getByText('7º ano A',{exact:true}).first().waitFor();
 await page.screenshot({path:'docs/motion/assets/turmas.png'});
 console.log(await page.locator('body').innerText());
 await page.getByRole('button',{name:'Alunos',exact:true}).first().click();
 await page.getByText('Ana Clara Martins',{exact:true}).first().waitFor();
 await page.screenshot({path:'docs/motion/assets/alunos.png'});
 console.log('ALUNOS',await page.locator('body').innerText());
 await page.getByRole('button',{name:/Provas coletivas/}).first().click();
 await page.screenshot({path:'docs/motion/assets/provas.png'});
 console.log('PROVAS',await page.locator('body').innerText());
 await page.getByRole('button',{name:'Preparar provas de 7º ano A',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.screenshot({path:'docs/motion/assets/preparar.png'});
 await page.getByRole('dialog').screenshot({path:'docs/motion/assets/formulario.png'});
 console.log('DIALOG',await page.getByRole('dialog').innerText());
} finally {await browser.close();}
