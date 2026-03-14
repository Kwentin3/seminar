import type { Locale } from "@seminar/contracts";

type HeaderMessages = {
  title: string;
  subtitle: string;
  landing: string;
  admin: string;
  cabinet: string;
  languageLabel: string;
  themeLabel: string;
  themeLight: string;
  themeDark: string;
};

type HeroVariantCopyMessages = {
  headline: string;
  subheadline: string;
  fomo: string;
};

type HeroVariantsMessages = {
  aggressive: HeroVariantCopyMessages;
  rational: HeroVariantCopyMessages;
  partner: HeroVariantCopyMessages;
};

type LandingMessages = {
  heading: string;
  summary: string;
  heroFomoLine: string;
  hero: {
    variant: HeroVariantsMessages;
  };
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

type CabinetMessages = {
  login: {
    heading: string;
    description: string;
    loginLabel: string;
    passwordLabel: string;
    submitIdle: string;
    submitLoading: string;
    checkingSession: string;
    errors: {
      invalidCredentials: string;
      rateLimited: string;
      generic: string;
    };
  };
  library: {
    heading: string;
    description: string;
    loading: string;
    empty: string;
    sessionLoading: string;
    logout: string;
    filters: {
      searchLabel: string;
      searchPlaceholder: string;
      statusLabel: string;
      typeLabel: string;
      categoryLabel: string;
      allStatuses: string;
      allTypes: string;
      allCategories: string;
    };
    statuses: {
      draft: string;
      working: string;
      final: string;
    };
    fields: {
      status: string;
      type: string;
      category: string;
      theme: string;
      source: string;
      tags: string;
      audience: string;
      language: string;
      access: string;
      updated: string;
      curated: string;
    };
    prepStartHeading: string;
    prepStartDescription: string;
    restHeading: string;
    restDescription: string;
    contextToggle: string;
    contextHint: string;
    prepCues: {
      final: string;
      working: string;
      draft: string;
    };
    readMaterial: string;
    openSource: string;
    externalOnly: string;
    readableInPortal: string;
    helpfulForLecturer: string;
    recommendedForPrep: string;
    signedInAs: string;
    adminStats: string;
    llmSettings: string;
    userAdmin: string;
    errors: {
      generic: string;
    };
  };
  reader: {
    loading: string;
    backToLibrary: string;
    sourceLink: string;
    openExternally: string;
    noInAppContent: string;
    relatedHeading: string;
    errors: {
      generic: string;
      notFound: string;
    };
    fields: {
      status: string;
      type: string;
      category: string;
      theme: string;
      source: string;
      audience: string;
      language: string;
      tags: string;
      updated: string;
      curated: string;
    };
    statuses: {
      draft: string;
      working: string;
      final: string;
    };
    contextToggle: string;
    contextHint: string;
    quickFactsHeading: string;
    prepCues: {
      final: string;
      working: string;
      draft: string;
    };
    recommendedForPrep: string;
    simplify: {
      action: string;
      originalTab: string;
      simplifiedTab: string;
      panelHeading: string;
      loading: string;
      loadingState: string;
      idle: string;
      disabled: string;
      disabledMissingKey: string;
      stale: string;
      staleBadge: string;
      failed: string;
      failedBadge: string;
      fromCache: string;
      generatedNow: string;
      generating: string;
      disabledBadge: string;
      truncatedWarning: string;
      truncatedHint: string;
      generatedAt: string;
      regenerate: string;
      regenerating: string;
      refreshStale: string;
      retry: string;
      disclaimer: string;
      unavailable: string;
    };
  };
  llmSettings: {
    heading: string;
    description: string;
    loading: string;
    forbidden: string;
    error: string;
    backToLibrary: string;
    keyConfigured: string;
    keyMissing: string;
    promptVersion: string;
    updatedAt: string;
    updatedBy: string;
    featureToggle: string;
    featureHint: string;
    modelLabel: string;
    temperatureLabel: string;
    maxTokensLabel: string;
    optionalPlaceholder: string;
    promptLabel: string;
    documentPromptLabel: string;
    documentPromptHint: string;
    saveIdle: string;
    saveLoading: string;
    saveSuccess: string;
    testIdle: string;
    testLoading: string;
    connection: {
      idle: string;
      success: string;
      missingKey: string;
      failed: string;
    };
  };
  userAdmin: {
    heading: string;
    description: string;
    loading: string;
    forbidden: string;
    error: string;
    backToLibrary: string;
    openLlmSettings: string;
    createHeading: string;
    createDescription: string;
    createUsernameLabel: string;
    createEmailLabel: string;
    createPasswordLabel: string;
    createSubmitIdle: string;
    createSubmitLoading: string;
    createSuccess: string;
    empty: string;
    tableCaption: string;
    columns: {
      user: string;
      role: string;
      status: string;
      lastLogin: string;
      updated: string;
      actions: string;
    };
    roleViewer: string;
    roleAdmin: string;
    active: string;
    inactive: string;
    neverLoggedIn: string;
    resetPasswordLabel: string;
    resetPasswordHint: string;
    resetPasswordIdle: string;
    resetPasswordLoading: string;
    resetPasswordSuccess: string;
    deactivateIdle: string;
    activateIdle: string;
    toggleLoading: string;
    selfDeactivateBlocked: string;
  };
};

export type AppMessages = {
  header: HeaderMessages;
  landing: LandingMessages;
  admin: AdminMessages;
  cabinet: CabinetMessages;
};

export const MESSAGES: Record<Locale, AppMessages> = {
  ru: {
    header: {
      title: "Семинары",
      subtitle: "Phase 1 foundation",
      landing: "Лендинг",
      admin: "Админ",
      cabinet: "Кабинет",
      languageLabel: "Язык",
      themeLabel: "Тема",
      themeLight: "Светлая",
      themeDark: "Темная"
    },
    landing: {
      heading: "Landing Foundation",
      summary: "Контентный лендинг: роли и user stories полностью рендерятся из JSON.",
      heroFomoLine: "Каждая роль получает реальные кейсы с измеримым эффектом без смены контекста страницы.",
      hero: {
        variant: {
          aggressive: {
            headline: "ИИ уже встроен в процессы ваших конкурентов.",
            subheadline: "Они ускоряются каждый день. Разрыв в скорости и маржинальности растёт.",
            fomo: "Догонять всегда дороже, чем внедрять первыми."
          },
          rational: {
            headline: "Где ИИ даёт измеримый эффект в вашем бизнесе?",
            subheadline: "Сокращение времени, рост конверсии, стандартизация процессов.",
            fomo: "Без системного внедрения эффект остаётся случайным."
          },
          partner: {
            headline: "Мы работаем внутри процессов, а не рассказываем про ИИ.",
            subheadline: "Продажи, операции, IT — реальные сценарии, реальные цифры.",
            fomo: "ИИ становится инфраструктурой. Вопрос — управляемой или хаотичной."
          }
        }
      },
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
    },
    cabinet: {
      login: {
        heading: "Вход в кабинет",
        description: "Внутренний кабинет команды для работы с seminar-материалами.",
        loginLabel: "Логин или email",
        passwordLabel: "Пароль",
        submitIdle: "Войти",
        submitLoading: "Входим...",
        checkingSession: "Проверяем сессию...",
        errors: {
          invalidCredentials: "Неверный логин или пароль.",
          rateLimited: "Слишком много попыток входа. Попробуйте позже.",
          generic: "Не удалось выполнить вход. Повторите попытку."
        }
      },
      library: {
        heading: "Библиотека материалов",
        description: "Curated слой поверх материалов из репозитория для внутренней команды.",
        loading: "Загружаем материалы...",
        empty: "Материалы пока не найдены.",
        sessionLoading: "Проверяем доступ к кабинету...",
        logout: "Выйти",
        filters: {
          searchLabel: "Поиск",
          searchPlaceholder: "Название, summary, тег",
          statusLabel: "Статус",
          typeLabel: "Тип",
          categoryLabel: "Категория",
          allStatuses: "Все статусы",
          allTypes: "Все типы",
          allCategories: "Все категории"
        },
        statuses: {
          draft: "Черновик",
          working: "Рабочий",
          final: "Опорный"
        },
        fields: {
          status: "Статус",
          type: "Тип",
          category: "Категория",
          theme: "Тема",
          source: "Источник",
          tags: "Теги",
          audience: "Аудитория",
          language: "Язык",
          access: "Режим чтения",
          updated: "Источник обновлён",
          curated: "Проверено куратором"
        },
        prepStartHeading: "С чего начать",
        prepStartDescription: "Опорные и рекомендованные материалы, с которых проще начать подготовку.",
        restHeading: "Остальная библиотека",
        restDescription: "Дополнительный контекст, рабочие материалы и справочные источники.",
        contextToggle: "Контекст и источник",
        contextHint: "Показать источник, теги и служебные детали",
        prepCues: {
          final: "Можно брать первым как текущую опору.",
          working: "Хорошая рабочая версия для подготовки.",
          draft: "Читайте как дополнительный контекст."
        },
        readMaterial: "Читать в кабинете",
        openSource: "Открыть источник",
        externalOnly: "Открывается отдельно",
        readableInPortal: "Можно читать прямо в кабинете",
        helpfulForLecturer: "Подборка для подготовки лектора: кратко понять материал и быстро перейти к чтению.",
        recommendedForPrep: "Рекомендуем для подготовки",
        signedInAs: "Вы вошли как",
        adminStats: "Материалов: {count}. Категории: {categories}.",
        llmSettings: "LLM-настройки",
        userAdmin: "Пользователи",
        errors: {
          generic: "Не удалось загрузить библиотеку материалов."
        }
      },
      reader: {
        loading: "Открываем материал...",
        backToLibrary: "Назад к библиотеке",
        sourceLink: "Открыть исходный файл",
        openExternally: "Открыть отдельно",
        noInAppContent: "Этот материал пока открывается во внешнем просмотре. В кабинете сохранены его карточка и контекст.",
        relatedHeading: "Связанные материалы",
        errors: {
          generic: "Не удалось открыть материал.",
          notFound: "Материал не найден или больше не доступен."
        },
        fields: {
          status: "Статус",
          type: "Тип",
          category: "Категория",
          theme: "Тема",
          source: "Источник",
          audience: "Аудитория",
          language: "Язык",
          tags: "Теги",
          updated: "Источник обновлён",
          curated: "Проверено куратором"
        },
        statuses: {
          draft: "Черновик",
          working: "Рабочий",
          final: "Опорный"
        },
        contextToggle: "Контекст материала",
        contextHint: "Источник, теги и служебные поля",
        quickFactsHeading: "Коротко о материале",
        prepCues: {
          final: "Текущая опора: можно сразу входить в текст.",
          working: "Рабочая версия: полезно читать для подготовки.",
          draft: "Дополнительный контекст, а не главная опора."
        },
        recommendedForPrep: "Рекомендуем для подготовки",
        simplify: {
          action: "Пересказать простым языком",
          originalTab: "Оригинал",
          simplifiedTab: "Простым языком",
          panelHeading: "Упрощённый пересказ",
          loading: "Проверяем состояние пересказа...",
          loadingState: "Генерируем упрощённую версию...",
          idle: "Пересказ ещё не создан. Нажмите кнопку, чтобы получить упрощённую версию текста.",
          disabled: "Функция временно отключена в настройках кабинета.",
          disabledMissingKey: "DeepSeek API key ещё не настроен. Обратитесь к администратору кабинета.",
          stale: "Доступна устаревшая версия пересказа. Можно обновить её повторной генерацией.",
          staleBadge: "Устарело",
          failed: "Не удалось получить упрощённую версию.",
          failedBadge: "Ошибка",
          fromCache: "Из кэша",
          generatedNow: "Сгенерировано",
          generating: "Генерируется",
          disabledBadge: "Недоступно",
          truncatedWarning: "Текст пересказа был обрезан по лимиту длины.",
          truncatedHint: "Если пересказ обрывается, увеличьте Max output tokens в LLM-настройках и перегенерируйте.",
          generatedAt: "Сгенерировано: {value}",
          regenerate: "Перегенерировать",
          regenerating: "Перегенерируем...",
          refreshStale: "Обновить пересказ",
          retry: "Попробовать снова",
          disclaimer: "Это упрощённый LLM-пересказ. Для точных формулировок сверяйтесь с оригиналом.",
          unavailable: "Упрощённая версия сейчас недоступна."
        }
      },
      llmSettings: {
        heading: "LLM-настройки reader-а",
        description: "Минимальная admin-панель для prompt/model настроек и проверки связи с DeepSeek.",
        loading: "Загружаем настройки LLM...",
        forbidden: "Эта страница доступна только администратору кабинета.",
        error: "Не удалось загрузить или сохранить настройки LLM.",
        backToLibrary: "Назад к библиотеке",
        keyConfigured: "API key настроен",
        keyMissing: "API key не настроен",
        promptVersion: "Версия промта: {value}",
        updatedAt: "Обновлено: {value}",
        updatedBy: "Кем: {value}",
        featureToggle: "Включить reader-пересказ",
        featureHint: "Если опция выключена, кнопка пересказа останется недоступной даже при настроенном ключе.",
        modelLabel: "Модель",
        temperatureLabel: "Temperature",
        maxTokensLabel: "Max output tokens",
        optionalPlaceholder: "Необязательно",
        promptLabel: "Системный промт пересказа",
        documentPromptLabel: "Шаблон prompt с документом",
        documentPromptHint: "Доступные токены: {{material_title}}, {{material_slug}}, {{material_source_path}}, {{source_markdown}}.",
        saveIdle: "Сохранить настройки",
        saveLoading: "Сохраняем...",
        saveSuccess: "Настройки сохранены.",
        testIdle: "Проверить связь с LLM",
        testLoading: "Проверяем...",
        connection: {
          idle: "Можно выполнить test connection перед релизом.",
          success: "Связь с LLM подтверждена",
          missingKey: "Проверка недоступна: API key не настроен.",
          failed: "Проверка связи завершилась ошибкой"
        }
      },
      userAdmin: {
        heading: "Пользователи кабинета",
        description: "Минимальная admin-панель для создания lecturer/viewer аккаунтов и безопасного управления доступом.",
        loading: "Загружаем пользователей кабинета...",
        forbidden: "Эта страница доступна только администратору кабинета.",
        error: "Не удалось загрузить или изменить пользователей кабинета.",
        backToLibrary: "Назад к библиотеке",
        openLlmSettings: "К LLM-настройкам",
        createHeading: "Добавить лектора",
        createDescription: "Создаёт новый cabinet-аккаунт с ролью viewer.",
        createUsernameLabel: "Username",
        createEmailLabel: "Email",
        createPasswordLabel: "Пароль",
        createSubmitIdle: "Создать lecturer",
        createSubmitLoading: "Создаём...",
        createSuccess: "Пользователь создан.",
        empty: "Пользователи пока не найдены.",
        tableCaption: "Список пользователей кабинета",
        columns: {
          user: "Пользователь",
          role: "Роль",
          status: "Статус",
          lastLogin: "Последний вход",
          updated: "Обновлено",
          actions: "Действия"
        },
        roleViewer: "Lecturer / viewer",
        roleAdmin: "Admin",
        active: "Активен",
        inactive: "Отключён",
        neverLoggedIn: "ещё не входил",
        resetPasswordLabel: "Новый пароль",
        resetPasswordHint: "После сброса текущие сессии пользователя будут завершены.",
        resetPasswordIdle: "Сменить пароль",
        resetPasswordLoading: "Обновляем пароль...",
        resetPasswordSuccess: "Пароль обновлён.",
        deactivateIdle: "Отключить",
        activateIdle: "Включить",
        toggleLoading: "Сохраняем...",
        selfDeactivateBlocked: "Свой аккаунт отключить нельзя."
      }
    }
  },
  en: {
    header: {
      title: "Seminars",
      subtitle: "Phase 1 foundation",
      landing: "Landing",
      admin: "Admin",
      cabinet: "Cabinet",
      languageLabel: "Language",
      themeLabel: "Theme",
      themeLight: "Light",
      themeDark: "Dark"
    },
    landing: {
      heading: "Landing Foundation",
      summary: "Content-driven landing: roles and user stories are rendered from JSON.",
      heroFomoLine: "Each role gets measurable real-world cases without leaving the current page context.",
      hero: {
        variant: {
          aggressive: {
            headline: "ИИ уже встроен в процессы ваших конкурентов.",
            subheadline: "Они ускоряются каждый день. Разрыв в скорости и маржинальности растёт.",
            fomo: "Догонять всегда дороже, чем внедрять первыми."
          },
          rational: {
            headline: "Где ИИ даёт измеримый эффект в вашем бизнесе?",
            subheadline: "Сокращение времени, рост конверсии, стандартизация процессов.",
            fomo: "Без системного внедрения эффект остаётся случайным."
          },
          partner: {
            headline: "Мы работаем внутри процессов, а не рассказываем про ИИ.",
            subheadline: "Продажи, операции, IT — реальные сценарии, реальные цифры.",
            fomo: "ИИ становится инфраструктурой. Вопрос — управляемой или хаотичной."
          }
        }
      },
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
    },
    cabinet: {
      login: {
        heading: "Cabinet login",
        description: "Internal team cabinet for seminar materials.",
        loginLabel: "Username or email",
        passwordLabel: "Password",
        submitIdle: "Sign in",
        submitLoading: "Signing in...",
        checkingSession: "Checking session...",
        errors: {
          invalidCredentials: "Invalid login or password.",
          rateLimited: "Too many login attempts. Please try again later.",
          generic: "Unable to sign in. Please try again."
        }
      },
      library: {
        heading: "Materials library",
        description: "Curated library over repository materials for the internal team.",
        loading: "Loading materials...",
        empty: "No materials found yet.",
        sessionLoading: "Checking cabinet access...",
        logout: "Logout",
        filters: {
          searchLabel: "Search",
          searchPlaceholder: "Title, summary, tag",
          statusLabel: "Status",
          typeLabel: "Type",
          categoryLabel: "Category",
          allStatuses: "All statuses",
          allTypes: "All types",
          allCategories: "All categories"
        },
        statuses: {
          draft: "Draft",
          working: "Working",
          final: "Anchor"
        },
        fields: {
          status: "Status",
          type: "Type",
          category: "Category",
          theme: "Theme",
          source: "Source",
          tags: "Tags",
          audience: "Audience",
          language: "Language",
          access: "Reading mode",
          updated: "Source updated",
          curated: "Curator reviewed"
        },
        prepStartHeading: "Start here",
        prepStartDescription: "Anchor and recommended materials that are easiest to start lecture prep with.",
        restHeading: "More materials",
        restDescription: "Additional context, working notes, and supporting references.",
        contextToggle: "Context and source",
        contextHint: "Show source path, tags, and secondary metadata",
        prepCues: {
          final: "Safe to start with first as the current anchor.",
          working: "Useful working version for lecture prep.",
          draft: "Read as supporting context."
        },
        readMaterial: "Read in cabinet",
        openSource: "Open source",
        externalOnly: "Opens separately",
        readableInPortal: "Readable directly in cabinet",
        helpfulForLecturer: "Curated lecturer prep layer: understand the material quickly and jump into reading.",
        recommendedForPrep: "Recommended for lecture prep",
        signedInAs: "Signed in as",
        adminStats: "Materials: {count}. Categories: {categories}.",
        llmSettings: "LLM settings",
        userAdmin: "Users",
        errors: {
          generic: "Unable to load the materials library."
        }
      },
      reader: {
        loading: "Opening material...",
        backToLibrary: "Back to library",
        sourceLink: "Open source file",
        openExternally: "Open separately",
        noInAppContent: "This material currently opens in an external viewer. Cabinet keeps its card and context available here.",
        relatedHeading: "Related materials",
        errors: {
          generic: "Unable to open the material.",
          notFound: "Material was not found or is no longer available."
        },
        fields: {
          status: "Status",
          type: "Type",
          category: "Category",
          theme: "Theme",
          source: "Source",
          audience: "Audience",
          language: "Language",
          tags: "Tags",
          updated: "Source updated",
          curated: "Curator reviewed"
        },
        statuses: {
          draft: "Draft",
          working: "Working",
          final: "Anchor"
        },
        contextToggle: "Material context",
        contextHint: "Source, tags, and secondary metadata",
        quickFactsHeading: "Quick facts",
        prepCues: {
          final: "Current anchor: you can move straight into the text.",
          working: "Working version: useful for lecture prep.",
          draft: "Supporting context rather than the main anchor."
        },
        recommendedForPrep: "Recommended for lecture prep",
        simplify: {
          action: "Explain simply",
          originalTab: "Original",
          simplifiedTab: "Simplified",
          panelHeading: "Simplified retelling",
          loading: "Checking simplified state...",
          loadingState: "Generating simplified version...",
          idle: "No simplified version yet. Use the action to generate one for this document.",
          disabled: "This feature is currently disabled in cabinet settings.",
          disabledMissingKey: "DeepSeek API key is not configured yet. Contact a cabinet admin.",
          stale: "A stale simplified version is available. You can refresh it with regeneration.",
          staleBadge: "Stale",
          failed: "Unable to generate the simplified version.",
          failedBadge: "Error",
          fromCache: "From cache",
          generatedNow: "Generated",
          generating: "Generating",
          disabledBadge: "Unavailable",
          truncatedWarning: "The simplified text was cut off by the output length limit.",
          truncatedHint: "If the retelling stops mid-text, increase Max output tokens in LLM settings and regenerate.",
          generatedAt: "Generated: {value}",
          regenerate: "Regenerate",
          regenerating: "Regenerating...",
          refreshStale: "Refresh simplified view",
          retry: "Try again",
          disclaimer: "This is an LLM-generated simplification. Check the original for precise wording.",
          unavailable: "Simplified view is unavailable right now."
        }
      },
      llmSettings: {
        heading: "Reader LLM settings",
        description: "Minimal admin panel for prompt/model settings and DeepSeek connection checks.",
        loading: "Loading LLM settings...",
        forbidden: "This page is available only to cabinet admins.",
        error: "Unable to load or save LLM settings.",
        backToLibrary: "Back to library",
        keyConfigured: "API key configured",
        keyMissing: "API key missing",
        promptVersion: "Prompt version: {value}",
        updatedAt: "Updated: {value}",
        updatedBy: "By: {value}",
        featureToggle: "Enable simplified reader mode",
        featureHint: "When disabled, the simplify action stays unavailable even if a key is configured.",
        modelLabel: "Model",
        temperatureLabel: "Temperature",
        maxTokensLabel: "Max output tokens",
        optionalPlaceholder: "Optional",
        promptLabel: "Simplify system prompt",
        documentPromptLabel: "Document prompt template",
        documentPromptHint: "Available tokens: {{material_title}}, {{material_slug}}, {{material_source_path}}, {{source_markdown}}.",
        saveIdle: "Save settings",
        saveLoading: "Saving...",
        saveSuccess: "Settings saved.",
        testIdle: "Test LLM connection",
        testLoading: "Testing...",
        connection: {
          idle: "Run a connection check before rollout.",
          success: "LLM connection confirmed",
          missingKey: "Connection test unavailable: API key is missing.",
          failed: "Connection test failed"
        }
      },
      userAdmin: {
        heading: "Cabinet users",
        description: "Minimal admin panel for creating lecturer/viewer accounts and managing access safely.",
        loading: "Loading cabinet users...",
        forbidden: "This page is available only to cabinet admins.",
        error: "Unable to load or update cabinet users.",
        backToLibrary: "Back to library",
        openLlmSettings: "Open LLM settings",
        createHeading: "Add lecturer",
        createDescription: "Creates a new cabinet account with the viewer role.",
        createUsernameLabel: "Username",
        createEmailLabel: "Email",
        createPasswordLabel: "Password",
        createSubmitIdle: "Create lecturer",
        createSubmitLoading: "Creating...",
        createSuccess: "User created.",
        empty: "No cabinet users found yet.",
        tableCaption: "Cabinet users list",
        columns: {
          user: "User",
          role: "Role",
          status: "Status",
          lastLogin: "Last login",
          updated: "Updated",
          actions: "Actions"
        },
        roleViewer: "Lecturer / viewer",
        roleAdmin: "Admin",
        active: "Active",
        inactive: "Inactive",
        neverLoggedIn: "never logged in",
        resetPasswordLabel: "New password",
        resetPasswordHint: "Password reset invalidates the user's current sessions.",
        resetPasswordIdle: "Reset password",
        resetPasswordLoading: "Updating password...",
        resetPasswordSuccess: "Password updated.",
        deactivateIdle: "Deactivate",
        activateIdle: "Activate",
        toggleLoading: "Saving...",
        selfDeactivateBlocked: "You cannot deactivate your own account."
      }
    }
  }
};
