/* KL public-site validation. This file also runs in the publishing PR. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function validate(root){
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'scripts/itinerary.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'css/itinerary.css'),'utf8');
 for(const [name,text] of [['index.html',html],['scripts/itinerary.js',js],['css/itinerary.css',css]]){
  if(/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_|sk-proj-|-----BEGIN .*PRIVATE KEY|[A-Z]:[\\/]Users[\\/])/i.test(text))throw Error('Potential credential or private local path in '+name);
  if(/(?:id=["']local-editor|contenteditable|"photoSource"|"photoCrop"|createInlineItineraryAuthoring|setupCommitPublisher|klItineraryEditor)/.test(text))throw Error('Local editing code or private crop metadata in '+name);
 }
 const match=/<script\b[^>]*id="itinerary-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
 if(!match)throw Error('Missing itinerary data.');
 const data=JSON.parse(match[1]);if(!Array.isArray(data.days)||data.days.length!==6)throw Error('Expected six itinerary days.');
 const ids=new Set(),images=[data.railMap?.src,data.brand?.src,data.brand?.headerSrc];
 for(const day of data.days){
  if(!Array.isArray(day.stops))throw Error('Invalid activities.');
  for(const stop of day.stops){
   if(ids.has(stop.id)||!stop.name||!Array.isArray(stop.detailSteps)||!Array.isArray(stop.travelSteps))throw Error('Invalid activity '+stop.id);
   ids.add(stop.id);if(stop.photo)images.push(stop.photo);
   for(const link of stop.links){if(!/^https?:$/.test(new URL(link.href).protocol))throw Error('Unsafe activity link.');}
  }
 }
 for(const image of images.filter(Boolean)){
  if(!/^assets\/images\/[A-Za-z0-9_-]+\.(?:jpg|png|webp)$/.test(image))throw Error('Public images must be local generated assets.');
  const full=path.join(root,image);if(!fs.existsSync(full)||fs.lstatSync(full).isSymbolicLink()||!fs.statSync(full).size)throw Error('Missing or unsafe image '+image);
 }
 if(!fs.existsSync(path.join(root,'css/itinerary.css')))throw Error('Missing stylesheet.');
 const syntax=spawnSync(process.execPath,['--check',path.join(root,'scripts/itinerary.js')],{encoding:'utf8',windowsHide:true});
 if(syntax.status!==0)throw Error(syntax.stderr||'Invalid public JavaScript.');
 return {days:data.days.length,activities:ids.size,images:images.filter(Boolean).length};
}
if(require.main===module){try{console.log('PASS public-site validation',JSON.stringify(validate(process.argv[2]||process.cwd())));}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={validate};
