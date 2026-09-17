import assert from 'node:assert/strict';
import {orderCurriculumLessons} from '../src/curriculum-order.mjs';

const lesson=(book,number)=>({book,lesson:number});

assert.deepEqual(orderCurriculumLessons([lesson('初級 I',20),lesson('初級 I',1),lesson('初級 I',12)],1).map(item=>item.lesson),[1,12,20]);
assert.deepEqual(orderCurriculumLessons([lesson('初級 II',40),lesson('初級 I',25),lesson('初級 II',26),lesson('初級 I',21)],2).map(item=>`${item.book}:${item.lesson}`),['初級 I:21','初級 I:25','初級 II:26','初級 II:40']);
assert.deepEqual(orderCurriculumLessons([lesson('中級 I',4),lesson('初級 II',50),lesson('中級 I',1),lesson('初級 II',41)],3).map(item=>`${item.book}:${item.lesson}`),['初級 II:41','初級 II:50','中級 I:1','中級 I:4']);
assert.deepEqual(orderCurriculumLessons([lesson('中級 I',12),lesson('中級 I',5)],4).map(item=>item.lesson),[5,12]);
assert.deepEqual(orderCurriculumLessons([lesson('中級 II',20),lesson('中級 II',13)],5).map(item=>item.lesson),[13,20]);

console.log('Curriculum order tests passed.');
