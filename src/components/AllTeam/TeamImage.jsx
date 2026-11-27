export default function TeamImage({ image, name, className }) {
  return (
    <div className={className}>
      {image ? (
        <img src={image} alt={name} loading="lazy" />
      ) : (
        <div className="all-team-image-placeholder">
          <span>
            {name
              ?.split(" ")
              .map((word) => word[0])
              .slice(0, 2)
              .join("")}
          </span>
        </div>
      )}
    </div>
  );
}
