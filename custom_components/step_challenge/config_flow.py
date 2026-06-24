"""Config flow for Step Challenge."""
from __future__ import annotations

import re

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import selector

from .const import (
    CONF_CHALLENGE_NAME,
    CONF_DURATION_DAYS,
    CONF_PARTICIPANTS,
    CONF_RECORD_TIME,
    CONF_SHOW_BLUEPRINT_HINT,
    DEFAULT_CHALLENGE_NAME,
    DEFAULT_DURATION_DAYS,
    DEFAULT_RECORD_TIME,
    DEFAULT_SHOW_BLUEPRINT_HINT,
    DOMAIN,
    MIN_PARTICIPANTS,
)

_STEP_ENTITY_SELECTOR = selector.selector({"entity": {"domain": "sensor"}})
_TIME_SELECTOR = selector.selector({"time": {}})


def _make_key(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


class StepChallengeConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self) -> None:
        self._name: str = DEFAULT_CHALLENGE_NAME
        self._duration: int = DEFAULT_DURATION_DAYS
        self._record_time: str = DEFAULT_RECORD_TIME
        self._participants: list[dict] = []

    async def async_step_user(self, user_input=None) -> FlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            self._name        = user_input[CONF_CHALLENGE_NAME].strip()
            self._duration    = int(user_input[CONF_DURATION_DAYS])
            self._record_time = user_input[CONF_RECORD_TIME]
            return await self.async_step_add_participant()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_CHALLENGE_NAME, default=DEFAULT_CHALLENGE_NAME): str,
                vol.Required(CONF_DURATION_DAYS, default=DEFAULT_DURATION_DAYS): vol.All(
                    int, vol.Range(min=7, max=365)
                ),
                vol.Required(CONF_RECORD_TIME, default=DEFAULT_RECORD_TIME): _TIME_SELECTOR,
            }),
        )

    async def async_step_add_participant(self, user_input=None) -> FlowResult:
        errors: dict = {}
        if user_input is not None:
            name = user_input["participant_name"].strip()
            entity = user_input["step_entity"]
            if not name:
                errors["participant_name"] = "empty_name"
            else:
                key = _make_key(name)
                if any(p["key"] == key for p in self._participants):
                    errors["participant_name"] = "duplicate_name"
                else:
                    self._participants.append({"key": key, "name": name, "entity": entity})
                    return await self.async_step_add_more()

        current = ", ".join(p["name"] for p in self._participants) or "—"
        return self.async_show_form(
            step_id="add_participant",
            data_schema=vol.Schema({
                vol.Required("participant_name"): str,
                vol.Required("step_entity"): _STEP_ENTITY_SELECTOR,
            }),
            description_placeholders={"current_participants": current, "count": str(len(self._participants))},
            errors=errors,
        )

    async def async_step_add_more(self, user_input=None) -> FlowResult:
        if user_input is not None:
            if user_input["action"] == "add":
                return await self.async_step_add_participant()
            if len(self._participants) < MIN_PARTICIPANTS:
                return await self.async_step_add_participant()
            return self.async_create_entry(
                title=self._name,
                data={
                    CONF_CHALLENGE_NAME: self._name,
                    CONF_DURATION_DAYS:  self._duration,
                    CONF_RECORD_TIME:    self._record_time,
                    CONF_PARTICIPANTS:   self._participants,
                    CONF_SHOW_BLUEPRINT_HINT: DEFAULT_SHOW_BLUEPRINT_HINT,
                },
            )

        current = ", ".join(p["name"] for p in self._participants)
        return self.async_show_form(
            step_id="add_more",
            data_schema=vol.Schema({
                vol.Required("action", default="add"): vol.In({
                    "add": "Add another participant",
                    "finish": "Finish setup",
                }),
            }),
            description_placeholders={"current_participants": current, "count": str(len(self._participants)), "min": str(MIN_PARTICIPANTS)},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return StepChallengeOptionsFlow(config_entry)


class StepChallengeOptionsFlow(config_entries.OptionsFlowWithReload):

    def __init__(self, config_entry) -> None:
        self._participants: list[dict] = list(
            config_entry.options.get(CONF_PARTICIPANTS, config_entry.data.get(CONF_PARTICIPANTS, []))
        )
        self._name: str = config_entry.options.get(
            CONF_CHALLENGE_NAME, config_entry.data.get(CONF_CHALLENGE_NAME, DEFAULT_CHALLENGE_NAME)
        )
        self._duration: int = config_entry.options.get(
            CONF_DURATION_DAYS, config_entry.data.get(CONF_DURATION_DAYS, DEFAULT_DURATION_DAYS)
        )
        self._record_time: str = config_entry.options.get(
            CONF_RECORD_TIME, config_entry.data.get(CONF_RECORD_TIME, DEFAULT_RECORD_TIME)
        )
        self._show_hint: bool = config_entry.options.get(
            CONF_SHOW_BLUEPRINT_HINT, config_entry.data.get(CONF_SHOW_BLUEPRINT_HINT, DEFAULT_SHOW_BLUEPRINT_HINT)
        )

    async def async_step_init(self, user_input=None) -> FlowResult:
        if user_input is not None:
            action = user_input["action"]
            if action == "add":      return await self.async_step_add_participant()
            if action == "remove":   return await self.async_step_remove_participant()
            if action == "settings": return await self.async_step_settings()

        plist = ", ".join(p["name"] for p in self._participants) or "—"
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required("action"): vol.In({
                    "add":      "➕  Add participant",
                    "remove":   "➖  Remove participant",
                    "settings": "⚙️  Challenge settings",
                }),
            }),
            description_placeholders={
                "challenge_name": self._name,
                "duration": str(self._duration),
                "record_time": self._record_time,
                "participants": plist,
                "count": str(len(self._participants)),
            },
        )

    async def async_step_add_participant(self, user_input=None) -> FlowResult:
        errors: dict = {}
        if user_input is not None:
            name = user_input["participant_name"].strip()
            entity = user_input["step_entity"]
            if not name:
                errors["participant_name"] = "empty_name"
            else:
                key = _make_key(name)
                if any(p["key"] == key for p in self._participants):
                    errors["participant_name"] = "duplicate_name"
                else:
                    self._participants.append({"key": key, "name": name, "entity": entity})
                    return await self.async_step_add_another()

        current = ", ".join(p["name"] for p in self._participants) or "—"
        return self.async_show_form(
            step_id="add_participant",
            data_schema=vol.Schema({
                vol.Required("participant_name"): str,
                vol.Required("step_entity"): _STEP_ENTITY_SELECTOR,
            }),
            description_placeholders={"current_participants": current},
            errors=errors,
        )

    async def async_step_add_another(self, user_input=None) -> FlowResult:
        if user_input is not None:
            if user_input["action"] == "add":
                return await self.async_step_add_participant()
            return self._save()

        last = self._participants[-1]["name"] if self._participants else ""
        current = ", ".join(p["name"] for p in self._participants)
        return self.async_show_form(
            step_id="add_another",
            data_schema=vol.Schema({
                vol.Required("action", default="done"): vol.In({
                    "add": "➕  Add another participant",
                    "done": "✅  Done",
                }),
            }),
            description_placeholders={"last_added": last, "current_participants": current},
        )

    async def async_step_remove_participant(self, user_input=None) -> FlowResult:
        if not self._participants:
            return await self.async_step_init()
        if user_input is not None:
            self._participants = [p for p in self._participants if p["key"] != user_input["participant_key"]]
            return await self.async_step_remove_another()

        choices = {p["key"]: p["name"] for p in self._participants}
        return self.async_show_form(
            step_id="remove_participant",
            data_schema=vol.Schema({vol.Required("participant_key"): vol.In(choices)}),
            description_placeholders={"count": str(len(self._participants))},
        )

    async def async_step_remove_another(self, user_input=None) -> FlowResult:
        if user_input is not None:
            if user_input["action"] == "remove" and self._participants:
                return await self.async_step_remove_participant()
            return self._save()

        current = ", ".join(p["name"] for p in self._participants) or "—"
        return self.async_show_form(
            step_id="remove_another",
            data_schema=vol.Schema({
                vol.Required("action", default="done"): vol.In({
                    "remove": "➖  Remove another participant",
                    "done": "✅  Done",
                }),
            }),
            description_placeholders={"current_participants": current},
        )

    async def async_step_settings(self, user_input=None) -> FlowResult:
        if user_input is not None:
            self._name        = user_input[CONF_CHALLENGE_NAME].strip()
            self._duration    = int(user_input[CONF_DURATION_DAYS])
            self._record_time = user_input[CONF_RECORD_TIME]
            self._show_hint   = user_input[CONF_SHOW_BLUEPRINT_HINT]
            return self._save()

        return self.async_show_form(
            step_id="settings",
            data_schema=vol.Schema({
                vol.Required(CONF_CHALLENGE_NAME, default=self._name): str,
                vol.Required(CONF_DURATION_DAYS, default=self._duration): vol.All(
                    int, vol.Range(min=7, max=365)
                ),
                vol.Required(CONF_RECORD_TIME, default=self._record_time): _TIME_SELECTOR,
                vol.Required(CONF_SHOW_BLUEPRINT_HINT, default=self._show_hint): bool,
            }),
        )

    def _save(self) -> FlowResult:
        return self.async_create_entry(
            title=self._name,
            data={
                CONF_CHALLENGE_NAME:      self._name,
                CONF_DURATION_DAYS:       self._duration,
                CONF_RECORD_TIME:         self._record_time,
                CONF_PARTICIPANTS:        self._participants,
                CONF_SHOW_BLUEPRINT_HINT: self._show_hint,
            },
        )
