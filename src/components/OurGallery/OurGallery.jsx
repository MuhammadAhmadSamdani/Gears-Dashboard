import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

import "./OurGallery.css";

import galleryImages from "./GalleryData";
import timelineData from "./TimelineData";

import { publicApi } from "../../services/api";
import { useRemoteData } from "../../hooks/useRemoteData";


// ===============================
// GALLERY CARD
// ===============================

const GalleryCard = ({ item, index }) => {
  // sirf pehli 2 images LCP ke liye eager + high priority
  const isAboveFold = index < 2;

  return (
    <article className="our-gallery-card">

      <img
        src={item.image}
        alt={item.alt || `GEARS Gallery ${index + 1}`}
        loading={isAboveFold ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={isAboveFold ? "high" : "low"}
      />

      <div className="gallery-card-overlay">

        <span className="gallery-number">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="gallery-overlay-bottom">

          <p>
            {item.category || "GEARS"}
          </p>

          <h3>
            {/* {item.alt} */}
          </h3>

        </div>

      </div>

    </article>
  );
};


// ===============================
// TIMELINE CARD
// ===============================

const TimelineCard = ({ item, index }) => {
  return (
    <motion.div
      className="timeline-card"

      initial={{
        opacity: 0,
        x: 80,
      }}

      whileInView={{
        opacity: 1,
        x: 0,
      }}

      viewport={{
        once: true,
        amount: 0.2,
      }}

      transition={{
        duration: 0.6,
        delay: Math.min(index * 0.08, 0.4), // zyada items par delay zyada na barhe
      }}
    >

      <span className="timeline-year">
        {item.year}
      </span>

      <div className="timeline-dot" />

      <div className="timeline-content">

        <h3>
          {item.title}
        </h3>

        <p>
          {item.description}
        </p>

      </div>

    </motion.div>
  );
};


// ===============================
// MAIN GALLERY
// ===============================

const OurGallery = () => {
  const timelineRef = useRef(null);
  const { data: images } = useRemoteData(
    publicApi.gallery,
    (response) => response?.images,
    galleryImages
  );

  useEffect(() => {
    const timeline = timelineRef.current;
    const scrollTimeline = (event) => {
      if (!event.cancelable || event.ctrlKey) return;

      event.preventDefault();
      const unit = [1, 16, timeline.clientWidth][event.deltaMode] ?? 1;
      const { deltaX, deltaY } = event;
      const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
      timeline.scrollBy({ left: delta * unit, behavior: "instant" });
    };

    timeline.addEventListener("wheel", scrollTimeline, { passive: false });
    return () => timeline.removeEventListener("wheel", scrollTimeline);
  }, []);

  return (
    <section className="our-gallery">

      {/* BACKGROUND TEXT */}

      <div
        className="gallery-bg-word gallery-bg-word-one"
        aria-hidden="true"
      >
        GEARS
      </div>


      <div className="our-gallery-container">


        {/* ===============================
            HERO
        =============================== */}

        <motion.div
          className="gallery-header"

          initial={{
            opacity: 0,
            y: 60,
          }}

          whileInView={{
            opacity: 1,
            y: 0,
          }}

          viewport={{
            once: true,
            amount: 0.2,
          }}

          transition={{
            duration: 0.7,
          }}
        >

          <span className="gallery-eyebrow">
            CAPTURING EVERY MILESTONE
          </span>


          <h1>
            OUR <span>GALLERY</span>
          </h1>


          <p>
            Every competition, workshop, achievement and memorable
            moment tells the story of our passion for robotics,
            innovation and teamwork. Explore the journey that
            continues to shape GEARS year after year.
          </p>

        </motion.div>


        {/* ===============================
            GALLERY
        =============================== */}

        <div className="gallery-grid">

          {images.map((item, index) => (
            <GalleryCard
              key={item.id}
              item={item}
              index={index}
            />
          ))}

        </div>


        {/* ===============================
            TIMELINE HEADER
        =============================== */}

        <motion.div
          className="timeline-header"

          initial={{
            opacity: 0,
            y: 60,
          }}

          whileInView={{
            opacity: 1,
            y: 0,
          }}

          viewport={{
            once: true,
            amount: 0.2,
          }}

          transition={{
            duration: 0.7,
          }}
        >

          <span className="timeline-eyebrow">
            OUR JOURNEY
          </span>


          <h2 id="gallery-timeline-title">
            FROM <span>2016</span> TO TODAY
          </h2>


          <p>
            Every year represents a new milestone, new challenges,
            unforgettable memories and remarkable achievements that
            continue to shape the future of GEARS.
          </p>

        </motion.div>


        {/* ===============================
            TIMELINE
        =============================== */}

        <div className="timeline-wrapper">

          <div className="timeline-line" />

          <div
            className="timeline-scroll"
            ref={timelineRef}
            role="region"
            aria-labelledby="gallery-timeline-title"
            tabIndex={0}
          >

            {timelineData.map((item, index) => (
              <TimelineCard
                key={`${item.year}-${item.title}`}
                item={item}
                index={index}
              />
            ))}

          </div>

        </div>

      </div>

    </section>
  );
};


export default OurGallery;
