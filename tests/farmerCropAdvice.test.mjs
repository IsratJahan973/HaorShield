import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../frontend/src/FarmerCropAdvice.jsx',import.meta.url),'utf8');
const helpers=src.slice(src.indexOf('export function getFarmerAdvice'),src.indexOf('export default function')).replace('export function','function');
const advice=vm.runInNewContext(`${helpers}\ngetFarmerAdvice`);
const tests=[
 ['Boro seedling',()=>assert.match(advice('rice_boro','seedling','normal',[{rank:0}]).actions.join(' '),/Boro rice seedlings/)],
 ['Aman growing',()=>assert.match(advice('rice_aman','growing','normal',[{rank:0}]).actions.join(' '),/Aman rice plants/)],
 ['Aus harvest',()=>assert.match(advice('rice_aus','harvest','normal',[{rank:0}]).actions.join(' '),/Aus rice/)],
 ['Standing water overrides low forecast',()=>assert.match(advice('rice_aman','growing','wet',[{rank:0}]).message,/standing in your field/)],
 ['Rising river overrides low forecast',()=>assert.match(advice('rice_aman','growing','river',[{rank:0}]).message,/rising river water/)],
 ['Unavailable forecasts',()=>assert.match(advice('rice_aman','unknown','unknown',[]).message,/not available/)],
 ['High concern guidance',()=>assert.match(advice('rice_aus','harvest','normal',[{rank:2}]).message,/high/)],
 ['Vegetable seedling guidance',()=>assert.match(advice('vegetables','seedling','normal',[{rank:1}]).actions.join(' '),/seedling trays/)],
 ['Fish guidance',()=>assert.match(advice('fish','growing','normal',[{rank:1}]).actions.join(' '),/fish feed/)],
 ['Options present',()=>{for(const s of ['rice_boro','rice_aman','rice_aus','vegetables','fish','other']) assert.ok(src.includes(`"${s}"`));}],
 ['Number of instructions',()=>{for(const c of ['rice_boro','rice_aman','rice_aus','vegetables','fish','other']) assert.ok(advice(c,'unknown','normal',[{rank:1}]).actions.length>=3)}]
];
for(const [name,test] of tests){test();console.log('PASS',name)};
console.log(`${tests.length} passed`);
