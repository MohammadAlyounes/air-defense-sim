# Safety and scope

Air Defense Simulator is an **educational** project. It explains, at a textbook level, how a generic air-defense system turns sensor data into decisions. It is not a design tool, not a targeting tool, and not a model of any real system.

## Guardrails

- **Fictional equipment only.** No real system names, specifications or performance data. All parameters are round numbers chosen to make concepts visible.
- **Textbook-level physics.** Point-mass motion and public, widely taught equations (the radar range equation, Kalman filtering, proportional navigation). No real seeker, warhead or propulsion detail.
- **Fictional terrain and airspace.** Terrain is procedurally generated, and the civil air corridors are invented lanes. No real-world locations, bases, borders or air routes.
- **Defensive and non-graphic.** Effects stay abstract. Identification and rules-of-engagement mistakes, such as engaging a civil airliner, count as failures.

## Community contributions

Code, models and documentation contributed to this repository must follow the same rules. We will not accept:

- recreations of real sites, bases, units or events;
- real-system parameter sheets or performance data;
- content that targets real people, places or organizations.

## Limitations

The models are deliberately simplified; the main simplifications are listed under [Limits](docs/PHYSICS.md#limits). Results illustrate principles; they are not predictions about real-world systems.
