export function renderClientBootstrap({ tj }) {
  return `
const toast = (text, ok = true) => {
  const el = document.getElementById("toast");
  const d = document.createElement("div");
  d.className = "msg " + (ok ? "ok" : "err");
  d.textContent = text;
  el.appendChild(d);
  setTimeout(() => d.remove(), 3800);
};

const $ = (id) => document.getElementById(id);

const I = {
  cfgJsonParseStay: ${tj("toast.cfg_json_parse_stay")},
  cfgJsonParse: ${tj("toast.cfg_json_parse")},
  reloaded: ${tj("toast.reloaded")},
  saved: ${tj("toast.saved")},
  copied: ${tj("toast.copied")},
  addedAllowlist: ${tj("toast.added_allowlist")},
  noConversationSelected: ${tj("toast.no_conversation_selected")},
  conversationJsonParse: ${tj("toast.conversation_json_parse")},
  deleted: ${tj("toast.deleted")},
  providerAdded: ${tj("toast.provider_added")},
  promptAdded: ${tj("toast.prompt_added")},
  personaAdded: ${tj("toast.persona_added")},

  errLoadConfig: ${tj("err.load_config")},
  errReload: ${tj("err.reload")},
  errSave: ${tj("err.save")},
  errLoadChats: ${tj("err.load_chats")},
  errListConversations: ${tj("err.list_conversations")},
  errLoadConversation: ${tj("err.load_conversation")},
  errDelete: ${tj("err.delete")},
  errSearch: ${tj("err.search")},

  noResults: ${tj("search.no_results")},
  confirmDeleteConversation: ${tj("confirm.delete_conversation")},
  promptCopyChatId: ${tj("prompt.copy_chat_id")},

  actionCopy: ${tj("action.copy")},
  actionAllow: ${tj("action.allow")},
  actionRemove: ${tj("action.remove")},

  labelId: ${tj("label.id")},
  labelName: ${tj("label.name")},
  labelApiType: ${tj("label.api_type")},
  labelBaseUrl: ${tj("label.base_url")},
  labelApiKey: ${tj("label.api_key")},
  labelModel: ${tj("label.model")},
  labelExtraHeaders: ${tj("label.extra_headers")},
  labelResponsesStyle: ${tj("label.responses_style")},
  labelResponsesContentFormat: ${tj("label.responses_content_format")},
  labelSystemPrompt: ${tj("label.system_prompt")},
  labelSystemPersona: ${tj("label.system_persona")},

  wordProvider: ${tj("word.provider")},
  wordPrompt: ${tj("word.prompt")},
  wordPersona: ${tj("word.persona")},

  placeholderDisplayName: ${tj("placeholder.display_name")},
  keepBlank: ${tj("placeholder.keep_blank")},

  metaIdPrefix: ${tj("meta.id_prefix")},
  metaIdMissing: ${tj("meta.id_missing")},
  metaClickToOpen: ${tj("meta.click_to_open")},

  autoReplyOn: ${tj("chats.autoreply_on")},
  autoReplyOff: ${tj("chats.autoreply_off")}
};
`;
}
