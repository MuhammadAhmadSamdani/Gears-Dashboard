import "./Team.css";
import teamImage1 from "../../assets/images/Sir-Hassan.png";
import teamImage2 from "../../assets/images/Sir-Umer.png";
import teamImage3 from "../../assets/images/Sir-Umair.png";
import teamImage4 from "../../assets/images/Sir-Suhaib.png";

import { leadershipTeam } from "../AllTeam/AllTeamData";
import LeadershipCards from "../AllTeam/LeadershipCards";
import { publicApi } from "../../services/api";
import { useRemoteData } from "../../hooks/useRemoteData";

const homeImages = [teamImage1, teamImage2, teamImage3, teamImage4];
const fallbackMembers = homeImages.map((image, index) => ({
    ...leadershipTeam[index],
    image,
}));

const Team = () => {
    const { data: members } = useRemoteData(
        publicApi.home,
        (response) => response?.supervisors,
        fallbackMembers
    );

    return (
        <section className="team" id="team">
            <div className="all-team-container">
                <div className="team-title">
                    <h2>OUR TEAM</h2>
                    <p>
                        Meet the visionary leaders driving innovation and shaping the future of GEARS.
                    </p>
                </div>

                <LeadershipCards members={members} />
            </div>
        </section>
    );
};

export default Team;
