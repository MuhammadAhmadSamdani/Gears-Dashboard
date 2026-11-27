import "./AllTeam.css";
import TeamImage from "./TeamImage";

export default function LeadershipCards({ members }) {
  return (
    <div className="leadership-list">
      {members.map(({ id, image, name, designation, message, session }) => (
        <article className="leadership-member" key={id}>
          <TeamImage image={image} name={name} className="leadership-member-image" />

          <div className="leadership-member-content">
            <span className="team-designation">{designation}</span>
            <h3>{name}</h3>
            <div className="team-red-line" />
            {message && <p className="leadership-member-message">“{message}”</p>}
            {session && <span className="team-session">{session}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}
