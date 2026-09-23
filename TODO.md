Scratch pad for quick notes on things to do. Not necessarily in order of priority.

## Completed Items

* **Browser History / URL Hash Navigation:**
  * [x] **Primary Tab Routing**: Hash-based URL routing/history (`#dashboard`, `#hosts`, `#settings`) for the primary navigation tabs so browser back/forward buttons work properly.
  * [x] **Deep History & Linking (Dashboard & Services)**:
    * Service details and sub-tabs (`#dashboard/service/:guid/:host/:service` and deep links like `#dashboard/service/:guid/:host/:service/terminal`, `#dashboard/service/.../configs`, etc.).
    * Host details and sub-tabs (`#hosts/:host`, `#hosts/:host/firewall`, `#hosts/:host/cron`, `#hosts/:host/files`).
  * [x] **Modal States**: URL state preservation for active dialogs (`#dashboard/install` for the game server installer modal, and `#hosts/add` for the host enrollment modal) supporting back-button dismissal and bookmarking.
