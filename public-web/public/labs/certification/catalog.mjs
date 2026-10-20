export const CERTIFICATION_STAGES = Object.freeze([
  { id: "scope", code: "01", title: "Канон и границы", purpose: "Зафиксировать метод, область применения и версию источника." },
  { id: "competence", code: "02", title: "Карта компетенций", purpose: "Связать каждую компетенцию с наблюдаемым следом практики." },
  { id: "ethics", code: "03", title: "Этика и безопасность", purpose: "Показать согласие, отзыв, остановку и путь эскалации." },
  { id: "practice", code: "04", title: "Супервизируемая практика", purpose: "Провести минимум три кейса, не выдавая самоотчёт за результат." },
  { id: "supervision", code: "05", title: "Супервизионный разбор", purpose: "Отделить наблюдение супервизора от решения о допуске." },
  { id: "authorization", code: "06", title: "Авторизованное решение", purpose: "Передать проверяемый пакет уполномоченному субъекту решения." },
]);

export const DRAFT_COMPETENCIES = Object.freeze([
  { id: "object-authorship", title: "Объект и авторство", criterion: "Удерживает заявленный объект и не присваивает решение участника." },
  { id: "evidence-separation", title: "Наблюдение и интерпретация", criterion: "Разделяет наблюдаемый след, трактовку, гипотезу и неизвестное." },
  { id: "consent-withdrawal", title: "Согласие и отзыв", criterion: "Получает явное согласие и сохраняет работающий путь остановки и отзыва." },
  { id: "process-boundary", title: "Граница роли", criterion: "Ведёт процесс в заявленной области и не подменяет собой эксперта или автора." },
  { id: "evidence-escalation", title: "След и эскалация", criterion: "Фиксирует проверяемое основание, инциденты и следующий ответственный шаг." },
]);

export const REVIEW_STATUSES = Object.freeze(["observed", "not-yet-observed", "needs-review"]);
export const REVIEW_RECOMMENDATIONS = Object.freeze(["continue-practice", "ready-for-authorized-review", "pause"]);
