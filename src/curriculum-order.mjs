export const CURRICULUM_ORDER={
  1:[{book:'初級 I',lessons:Array.from({length:20},(_,index)=>index+1)}],
  2:[{book:'初級 I',lessons:[21,22,23,24,25]},{book:'初級 II',lessons:Array.from({length:15},(_,index)=>index+26)}],
  3:[{book:'初級 II',lessons:Array.from({length:10},(_,index)=>index+41)},{book:'中級 I',lessons:[1,2,3,4]}],
  4:[{book:'中級 I',lessons:[5,6,7,8,9,10,11,12]}],
  5:[{book:'中級 II',lessons:[13,14,15,16,17,18,19,20]}]
};

export function orderCurriculumLessons(lessons,schoolYear){
  const plan=CURRICULUM_ORDER[schoolYear]||[];
  const rank=new Map(plan.flatMap((group,bookIndex)=>group.lessons.map((lesson,lessonIndex)=>[`${group.book}|${lesson}`,[bookIndex,lessonIndex]])));
  return lessons
    .map((lesson,index)=>({lesson,index,rank:rank.get(`${lesson.book}|${lesson.lesson}`)}))
    .sort((a,b)=>{
      if(a.rank&&b.rank)return a.rank[0]-b.rank[0]||a.rank[1]-b.rank[1]||a.index-b.index;
      if(a.rank)return -1;
      if(b.rank)return 1;
      return a.index-b.index;
    })
    .map(entry=>entry.lesson);
}
