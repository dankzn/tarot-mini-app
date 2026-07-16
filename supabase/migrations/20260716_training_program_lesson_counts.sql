update public.training_programs
set
  duration_label = '10 занятий',
  includes = array['10 занятий', 'Личная траектория', 'Практика на ваших вопросах', 'Поддержка между встречами'],
  updated_at = now()
where slug = 'individual-basic';

update public.training_programs
set
  duration_label = '10 занятий',
  includes = array['10 занятий', 'Камерная группа', 'Домашние задания', 'Общий учебный ритм'],
  updated_at = now()
where slug = 'group-basic';

update public.training_programs
set
  duration_label = '14 занятий',
  includes = array['14 занятий', 'Расширенная практика', 'Этика консультаций', 'Разбор практики'],
  updated_at = now()
where slug = 'individual-advanced';
