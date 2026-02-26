import type { Locale } from "@seminar/contracts";

type HeaderMessages = {
  title: string;
  subtitle: string;
  landing: string;
  admin: string;
  languageLabel: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
};

type LandingMessages = {
  heading: string;
  summary: string;
  tabsLabel: string;
  storiesTitle: string;
  storyFields: {
    problem: string;
    solution: string;
    result: string;
  };
  states: {
    loading: string;
    error: string;
    empty: string;
  };
  leadForm: {
    title: string;
    description: string;
    nameLabel: string;
    phoneLabel: string;
    countryLabel: string;
    countryPlaceholder: string;
    countryHint: string;
    submitIdle: string;
    submitLoading: string;
    success: string;
    errors: {
      generic: string;
      turnstile: string;
      countryRequired: string;
      duplicateLead: string;
      rateLimited: string;
      siteKeyMissing: string;
    };
    countries: {
      RU: string;
      US: string;
      KZ: string;
      DE: string;
      GB: string;
      FR: string;
    };
  };
};

type AdminMessages = {
  heading: string;
  description: string;
  secretLabel: string;
  secretPlaceholder: string;
  loadButtonIdle: string;
  loadButtonLoading: string;
  tableCaption: string;
  emptyHint: string;
  copyPhone: string;
  copiedPhone: string;
  columns: {
    createdAt: string;
    name: string;
    phone: string;
    country: string;
    locale: string;
    source: string;
    actions: string;
  };
  states: {
    idle: string;
    loading: string;
    success: string;
    unauthorized: string;
    error: string;
    secretRequired: string;
  };
};

export type AppMessages = {
  header: HeaderMessages;
  landing: LandingMessages;
  admin: AdminMessages;
};

export const MESSAGES: Record<Locale, AppMessages> = {
  ru: {
    header: {
      title: "Семинары",
      subtitle: "Phase 1 foundation",
      landing: "Лендинг",
      admin: "Админ",
      languageLabel: "Язык",
      themeLabel: "Тема",
      themeLight: "Светлая",
      themeDark: "Темная"
    },
    landing: {
      heading: "Landing Foundation",
      summary: "Контентный лендинг: роли и user stories полностью рендерятся из JSON.",
      tabsLabel: "Роли",
      storiesTitle: "User stories",
      storyFields: {
        problem: "Проблема",
        solution: "Решение",
        result: "Эффект"
      },
      states: {
        loading: "Загрузка историй...",
        error: "Не удалось отобразить контент роли.",
        empty: "Для этой роли пока нет user stories."
      },
      leadForm: {
        title: "Оставить контакт",
        description: "Минимальная заявка: имя и телефон. Ответим без редиректов и сложных шагов.",
        nameLabel: "Имя",
        phoneLabel: "Телефон",
        countryLabel: "Страна",
        countryPlaceholder: "Выберите страну",
        countryHint: "Если номер не содержит код страны, выберите страну и отправьте повторно.",
        submitIdle: "Отправить",
        submitLoading: "Отправка...",
        success: "Заявка отправлена. Мы свяжемся с вами в ближайшее время.",
        errors: {
          generic: "Не удалось отправить заявку. Попробуйте еще раз.",
          turnstile: "Подтвердите, что вы не робот.",
          countryRequired: "Нужна страна, чтобы корректно обработать номер.",
          duplicateLead: "Похожая заявка уже была отправлена в последние 24 часа.",
          rateLimited: "Слишком много заявок за короткое время. Попробуйте позже.",
          siteKeyMissing: "Форма временно недоступна: отсутствует ключ Turnstile."
        },
        countries: {
          RU: "Россия",
          US: "США",
          KZ: "Казахстан",
          DE: "Германия",
          GB: "Великобритания",
          FR: "Франция"
        }
      }
    },
    admin: {
      heading: "Лиды",
      description: "Скрытая админ-панель: загрузка лидов из D1 по секрету в заголовке.",
      secretLabel: "Admin secret",
      secretPlaceholder: "Введите секрет",
      loadButtonIdle: "Загрузить лиды",
      loadButtonLoading: "Загрузка...",
      tableCaption: "Список лидов",
      emptyHint: "Лиды пока не найдены.",
      copyPhone: "Копировать телефон",
      copiedPhone: "Скопировано",
      columns: {
        createdAt: "Создан",
        name: "Имя",
        phone: "Телефон",
        country: "Страна",
        locale: "Язык",
        source: "Источник",
        actions: "Действия"
      },
      states: {
        idle: "Введите секрет и загрузите список лидов.",
        loading: "Загружаем лиды...",
        success: "Лиды загружены.",
        unauthorized: "Неверный секрет администратора.",
        error: "Не удалось загрузить лиды. Повторите попытку.",
        secretRequired: "Секрет обязателен."
      }
    }
  },
  en: {
    header: {
      title: "Seminars",
      subtitle: "Phase 1 foundation",
      landing: "Landing",
      admin: "Admin",
      languageLabel: "Language",
      themeLabel: "Theme",
      themeLight: "Light",
      themeDark: "Dark"
    },
    landing: {
      heading: "Landing Foundation",
      summary: "Content-driven landing: roles and user stories are rendered from JSON.",
      tabsLabel: "Roles",
      storiesTitle: "User stories",
      storyFields: {
        problem: "Problem",
        solution: "Solution",
        result: "Effect"
      },
      states: {
        loading: "Loading stories...",
        error: "Failed to render role content.",
        empty: "No user stories are available for this role yet."
      },
      leadForm: {
        title: "Leave your contact",
        description: "Minimal request: name and phone. We confirm submission without redirects.",
        nameLabel: "Name",
        phoneLabel: "Phone",
        countryLabel: "Country",
        countryPlaceholder: "Select country",
        countryHint: "If phone has no country code, select country and resubmit.",
        submitIdle: "Send",
        submitLoading: "Sending...",
        success: "Request submitted. We will contact you shortly.",
        errors: {
          generic: "Unable to submit your request. Please try again.",
          turnstile: "Please complete the anti-bot check.",
          countryRequired: "Country is required to normalize this phone number.",
          duplicateLead: "A similar request was already submitted in the last 24 hours.",
          rateLimited: "Too many requests in a short time. Please try again later.",
          siteKeyMissing: "Form is temporarily unavailable: Turnstile key is missing."
        },
        countries: {
          RU: "Russia",
          US: "United States",
          KZ: "Kazakhstan",
          DE: "Germany",
          GB: "United Kingdom",
          FR: "France"
        }
      }
    },
    admin: {
      heading: "Leads",
      description: "Hidden admin panel: load D1 leads using secret header access.",
      secretLabel: "Admin secret",
      secretPlaceholder: "Enter secret",
      loadButtonIdle: "Load leads",
      loadButtonLoading: "Loading...",
      tableCaption: "Leads list",
      emptyHint: "No leads found yet.",
      copyPhone: "Copy phone",
      copiedPhone: "Copied",
      columns: {
        createdAt: "Created at",
        name: "Name",
        phone: "Phone",
        country: "Country",
        locale: "Locale",
        source: "Source",
        actions: "Actions"
      },
      states: {
        idle: "Enter the secret and load leads.",
        loading: "Loading leads...",
        success: "Leads loaded.",
        unauthorized: "Invalid admin secret.",
        error: "Failed to load leads. Please try again.",
        secretRequired: "Admin secret is required."
      }
    }
  }
};
