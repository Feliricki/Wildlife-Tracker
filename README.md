# Wildlife Tracker

A full-stack web application that fetches and visualizes animal tracking data from [MoveBank.org](https://www.movebank.org). The application provides an interface for searching specific studies and displays the corresponding location data on an interactive 3D map.

* **Live Site:** [wildlife-tracker.com](https://wildlife-tracker.com)
* **Data Source:** [MoveBank.org](https://www.movebank.org)

---

![Wildlife Tracker Demonstration](https://wildlife-tracker.com/demo.gif)

## Technical Features

This project was built to demonstrate proficiency in full-stack development, with a focus on performance, modularity, and real-time data handling.

* **High-Performance WebGL Rendering:** To visualize large geospatial datasets, the application uses **deck.gl** to render data as a WebGL overlay on top of the selected base map, ensuring a smooth and interactive user experience.

* **Optimized Front-End Performance:** To prevent UI blocking when processing large volumes of data, the application offloads data filtering and processing from the main thread to a dedicated **Web Worker**.

* **Dual-Map Integration:** The application provides users with a choice of base maps, integrating both **Mapbox GL** and the **Google Maps JavaScript API**. The Google Maps API is loaded dynamically using the official `@googlemaps/js-api-loader` to optimize initial page load.

* **Real-Time Data Streaming:** A persistent, real-time connection between the client and server is established using **SignalR**. To minimize latency and payload size, communication is serialized using the efficient **MessagePack** binary format.

* **Secure API and Authentication:** The back-end is secured using **JWT-based authentication** managed by ASP.NET Core Identity. Custom middleware is also implemented to append security headers (`X-Frame-Options`, `Content-Security-Policy`, etc.) to HTTP responses, mitigating common web vulnerabilities.

* **Cloud-Based Configuration:** The API integrates with **AWS Secrets Manager** for secure runtime management of application secrets and credentials, avoiding the need to store sensitive information in the repository.

## Technology Stack

### Back-End

* **Framework:** ASP.NET Core 8 Web API
* **Database:** Entity Framework Core & SQL Server
* **Authentication:** ASP.NET Core Identity (JWT Bearer)
* **Real-time Communication:** SignalR, MessagePack
* **Cloud Services:** AWS SDK for .NET (Secrets Manager)
* **API Documentation:** Swashbuckle (Swagger)
* **Additional Libraries:** Mapster, CsvHelper

### Front-End

* **Framework:** Angular
* **Mapping & Visualization:** Mapbox GL, Google Maps JS API, deck.gl
* **UI Components:** Angular Material
* **Asynchronous Operations:** RxJS
* **Build Tools:** Angular CLI, TypeScript

## Project Roadmap

Future development will focus on expanding the application's feature set and improving the user experience.

* Implement user accounts to allow for saved settings and studies.
* Develop advanced search and filtering capabilities (e.g., by date, author, species).
* Integrate the deck.gl Trips Layer to animate animal movements over time.
* Enhance the control panel to provide more data visualization options.
* Refine the overall UI and UX.

## Acknowledgements

* **Data Source:** Wikelski M, Davidson SC, Kays R. [year]. Movebank: archive, analysis and sharing of animal movement data. Hosted by the Max Planck Institute of Animal Behavior. www.movebank.org
* **Research Paper:** Kays R, Davidson SC, Berger M, Bohrer G, et al. 2022. The Movebank system for studying global animal movement and demography. Methods Ecol Evol. https://doi.org/10.1111/2041-210X.13767
