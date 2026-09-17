export function labelForFlashcard(item){
  return item.type==='grammar'?'文法':'生字';
}

export function japaneseForFlashcard(item){
  return item.pattern||item.kanji||item.kana;
}

export function verbGroupLabel(item){
  return item.type==='vocabulary'&&item.verbGroup?`動詞組別：${item.verbGroup}`:'';
}
