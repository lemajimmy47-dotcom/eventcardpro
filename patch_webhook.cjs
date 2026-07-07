const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const oldParse = `                    let textBody = '';
                    if (message.text?.body) {
                      textBody = message.text.body.trim().toLowerCase();
                    } else if (message.button?.text) {
                      textBody = message.button.text.trim().toLowerCase();
                    } else if (message.button?.payload) {
                      textBody = message.button.payload.trim().toLowerCase();
                    } else if (message.interactive?.button_reply?.title) {
                      textBody = message.interactive.button_reply.title.trim().toLowerCase();
                    } else if (message.interactive?.button_reply?.id) {
                      textBody = message.interactive.button_reply.id.trim().toLowerCase();
                    }`;

const newParse = `                    let textBody = '';
                    if (message.text?.body) textBody += message.text.body + ' ';
                    if (message.button?.text) textBody += message.button.text + ' ';
                    if (message.button?.payload) textBody += message.button.payload + ' ';
                    if (message.interactive?.button_reply?.title) textBody += message.interactive.button_reply.title + ' ';
                    if (message.interactive?.button_reply?.id) textBody += message.interactive.button_reply.id + ' ';
                    if (message.interactive?.list_reply?.title) textBody += message.interactive.list_reply.title + ' ';
                    if (message.interactive?.list_reply?.id) textBody += message.interactive.list_reply.id + ' ';
                    textBody = textBody.trim().toLowerCase();`;

code = code.replace(oldParse, newParse);

const oldIf = `if (textBody.includes('ndio') || textBody.includes('yes') || textBody.includes('nitakuja') || textBody.includes('nitahudhuria') || textBody.includes('atahudhuria') || textBody.includes('1')) {`;
const newIf = `if (textBody.includes('ndio') || textBody.includes('yes') || textBody.includes('nitakuja') || textBody.includes('nitahudhuria') || textBody.includes('atahudhuria') || textBody.includes('kuhudhuria') || textBody.includes('tatahudhuria') || textBody.includes('ntahudhuria') || textBody.includes('ntakuja') || textBody.includes('nakuja') || textBody.includes('1')) {`;

code = code.replace(oldIf, newIf);

const oldElseIf = `} else if (textBody.includes('hapana') || textBody.includes('no') || textBody.includes('sitakuja') || textBody.includes('sintahudhuria') || textBody.includes('hatahudhuria') || textBody.includes('2')) {`;
const newElseIf = `} else if (textBody.includes('hapana') || textBody.includes('no') || textBody.includes('sitakuja') || textBody.includes('sintahudhuria') || textBody.includes('hatahudhuria') || textBody.includes('sitohudhuria') || textBody.includes('stahudhuria') || textBody.includes('2')) {`;

code = code.replace(oldElseIf, newElseIf);

fs.writeFileSync('server.ts', code);
